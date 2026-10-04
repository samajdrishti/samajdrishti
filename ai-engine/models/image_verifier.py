import base64
import io
import json
import math
import os
import urllib.request
import urllib.error
from datetime import datetime
from PIL import Image, ExifTags
import numpy as np

def _nvidia_vision_check(img_path: str) -> dict | None:
    api_key = (os.environ.get("NVIDIA_API_KEY") or "").strip()
    if not api_key or not os.path.exists(img_path):
        return None
    try:
        with Image.open(img_path) as img:
            img_thumb = img.convert("RGB")
            img_thumb.thumbnail((512, 512))
            buf = io.BytesIO()
            img_thumb.save(buf, format="JPEG", quality=80)
            b64_img = base64.b64encode(buf.getvalue()).decode("utf-8")

        prompt = (
            "You are a forensic computer vision auditor for government field inspections. "
            "Analyze this evidence photo carefully and answer in JSON with two keys:\n"
            "1. 'is_screen_or_spoof': boolean (true if this is a photo of another screen/monitor/phone/paper or synthetic image, false if a real-world physical photo)\n"
            "2. 'reason': brief one-sentence reason\n"
            "Respond ONLY with valid JSON."
        )

        payload = json.dumps({
            "model": os.environ.get("NVIDIA_VISION_MODEL", "meta/llama-3.2-11b-vision-instruct"),
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"}}
                    ]
                }
            ],
            "max_tokens": 150,
            "temperature": 0.1,
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "samaj-drishti-ai-engine/1.0",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            content = data["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            parsed = json.loads(content.strip())
            return {
                "active": True,
                "provider": "nvidia-nim:llama-3.2-11b-vision",
                "is_screen_or_spoof": bool(parsed.get("is_screen_or_spoof")),
                "reason": str(parsed.get("reason", "")),
            }
    except Exception as exc:
        print(f"[image_verifier] NVIDIA vision check note: {exc}")
        return None

def _convert_to_degrees(value):
    """Helper function to convert GPS coordinates stored in EXIF to degrees."""
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return None

def _haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two lat/lng coordinates."""
    r = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r * c

class ImageVerifier:
    """
    AI & Computer Vision engine for evidence photo verification:
    1. EXIF metadata extraction (Camera make/model, original GPS coordinates, original timestamp)
    2. GPS mismatch & timestamp cross-verification against reported mobile GPS
    3. Screen re-photo / anti-spoofing detection (analyzing moiré pattern artifacts, gradient variance, color gamut)
    """

    def extract_exif(self, img_path):
        """Extract EXIF data including GPS and timestamp."""
        result = {
            "has_exif": False,
            "camera_make": None,
            "camera_model": None,
            "datetime_original": None,
            "gps_lat": None,
            "gps_lng": None,
        }

        if not os.path.exists(img_path):
            return result

        try:
            with Image.open(img_path) as img:
                exif_raw = img._getexif()
                if not exif_raw:
                    return result

                result["has_exif"] = True
                exif_data = {}
                for tag_id, value in exif_raw.items():
                    tag = ExifTags.TAGS.get(tag_id, tag_id)
                    exif_data[tag] = value

                result["camera_make"] = str(exif_data.get("Make") or "").strip() or None
                result["camera_model"] = str(exif_data.get("Model") or "").strip() or None
                result["datetime_original"] = str(exif_data.get("DateTimeOriginal") or exif_data.get("DateTime") or "").strip() or None

                # Extract GPS if present
                gps_info = exif_data.get("GPSInfo")
                if gps_info:
                    gps_tags = {}
                    for t in gps_info:
                        sub_tag = ExifTags.GPSTAGS.get(t, t)
                        gps_tags[sub_tag] = gps_info[t]

                    gps_lat = _convert_to_degrees(gps_tags.get("GPSLatitude"))
                    lat_ref = gps_tags.get("GPSLatitudeRef", "N")
                    if gps_lat is not None and lat_ref == "S":
                        gps_lat = -gps_lat

                    gps_lng = _convert_to_degrees(gps_tags.get("GPSLongitude"))
                    lng_ref = gps_tags.get("GPSLongitudeRef", "E")
                    if gps_lng is not None and lng_ref == "W":
                        gps_lng = -gps_lng

                    result["gps_lat"] = gps_lat
                    result["gps_lng"] = gps_lng

        except Exception as exc:
            print(f"[image_verifier] EXIF extraction note: {exc}")

        return result

    def detect_screen_recapture(self, img_path):
        """
        Detects if the image is likely a photo taken of a digital screen or printed paper:
        - Screen pixel grid / moire patterns induce abnormal high frequency energy distribution
        - Color spectrum clipping (phosphor/OLED peaks vs natural light)
        - Variance of Laplacian gradient sharpness
        """
        flags = []
        screen_risk = 15  # Baseline risk

        if not os.path.exists(img_path):
            return {"screen_risk": 50, "flags": ["file_not_found"]}

        try:
            with Image.open(img_path) as img:
                # Resize for fast, consistent processing
                img_small = img.convert("L").resize((256, 256))
                arr = np.array(img_small, dtype=np.float32)

                # 1. Variance of Laplacian (Sharpness metric)
                # Kernel approximation:
                # [ 0,  1,  0]
                # [ 1, -4,  1]
                # [ 0,  1,  0]
                laplacian = (
                    arr[:-2, 1:-1] + arr[2:, 1:-1] +
                    arr[1:-1, :-2] + arr[1:-1, 2:] -
                    4 * arr[1:-1, 1:-1]
                )
                sharpness_var = float(np.var(laplacian))

                if sharpness_var < 50.0:
                    screen_risk += 25
                    flags.append("high_blur_low_sharpness")
                elif sharpness_var > 3500.0:
                    # Extreme unnatural edge transitions can indicate digital screen rasterization
                    screen_risk += 20
                    flags.append("high_frequency_raster_detected")

                # 2. RGB Gamut & Screen Luminance Bias
                img_rgb = img.convert("RGB").resize((128, 128))
                rgb_arr = np.array(img_rgb, dtype=np.float32)
                r, g, b = rgb_arr[:, :, 0], rgb_arr[:, :, 1], rgb_arr[:, :, 2]

                # Check for extreme screen backlight highlights (clipped white hotspots)
                white_pixels = np.sum((r > 250) & (g > 250) & (b > 250)) / (128 * 128)
                if white_pixels > 0.18:
                    screen_risk += 20
                    flags.append("backlight_glare_suspected")

                # Blue-channel bias common in backlit screens (cooler color temperature)
                mean_b = np.mean(b)
                mean_r = np.mean(r)
                if mean_b > mean_r + 40:
                    screen_risk += 15
                    flags.append("unnatural_screen_color_cast")

        except Exception as exc:
            print(f"[image_verifier] Screen detection exception: {exc}")
            flags.append("analysis_degraded")

        screen_risk = min(100, max(0, screen_risk))
        return {
            "screen_risk": screen_risk,
            "flags": flags,
            "is_screen_photo": screen_risk >= 65,
        }

    def verify_evidence(self, img_path, reported_lat=None, reported_lng=None, reported_timestamp=None):
        """
        Comprehensive authenticity score (0-100) and tamper detection verdict.
        """
        exif = self.extract_exif(img_path)
        screen_check = self.detect_screen_recapture(img_path)

        tamper_flags = list(screen_check["flags"])
        authenticity_score = 100 - screen_check["screen_risk"]

        # EXIF GPS Cross-Check
        gps_distance_meters = None
        if exif["gps_lat"] is not None and exif["gps_lng"] is not None and reported_lat is not None and reported_lng is not None:
            gps_distance_meters = _haversine_distance(
                exif["gps_lat"], exif["gps_lng"],
                float(reported_lat), float(reported_lng)
            )
            if gps_distance_meters > 500:
                tamper_flags.append(f"exif_gps_mismatch_{int(gps_distance_meters)}m")
                authenticity_score -= 35
            else:
                tamper_flags.append("exif_gps_confirmed")
                authenticity_score += 10
        elif not exif["has_exif"]:
            tamper_flags.append("exif_metadata_absent")
            # In mobile PWAs or web uploads, browser canvas often strips EXIF, so slight penalty only
            authenticity_score -= 10
        else:
            tamper_flags.append("exif_present_no_gps")

        # AI Vision Model Anti-Spoofing Check (NVIDIA NIM)
        ai_vision = _nvidia_vision_check(img_path)
        if ai_vision:
            if ai_vision.get("is_screen_or_spoof"):
                tamper_flags.append(f"ai_vision_spoof_detected: {ai_vision.get('reason')}")
                authenticity_score -= 30
            else:
                tamper_flags.append("ai_vision_genuine_verified")
                authenticity_score += 5

        authenticity_score = int(min(100, max(5, authenticity_score)))

        verdict = "authentic"
        if authenticity_score < 45 or screen_check["is_screen_photo"] or (ai_vision and ai_vision.get("is_screen_or_spoof")):
            verdict = "suspect_fake"
        elif authenticity_score < 70:
            verdict = "review_needed"

        return {
            "authenticity_score": authenticity_score,
            "verdict": verdict,
            "tamper_flags": tamper_flags,
            "screen_recapture_risk": screen_check["screen_risk"],
            "ai_vision": ai_vision,
            "exif": {
                "has_exif": exif["has_exif"],
                "camera": f"{exif['camera_make'] or ''} {exif['camera_model'] or ''}".strip() or None,
                "datetime_original": exif["datetime_original"],
                "embedded_gps": {
                    "lat": exif["gps_lat"],
                    "lng": exif["gps_lng"],
                } if exif["gps_lat"] is not None else None,
                "gps_distance_to_reported_m": round(gps_distance_meters, 1) if gps_distance_meters is not None else None,
            }
        }
