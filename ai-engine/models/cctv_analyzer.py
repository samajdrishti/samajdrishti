"""Computer-vision analysis of CCTV frames for tamper and obstruction detection.

The admin dashboard used to show obstruction / headcount / tamper values that were
hard-coded in the seed data, and ``/api/vision/cctv-anomaly`` simply echoed back the
numbers the caller supplied. Everything in this module is computed from actual
pixels, so a real obstruction in a real frame is now detected rather than asserted.

Detection pipeline, all on downscaled frames so it runs in a few milliseconds:

1. **Frame health** - luma mean/std, clipped-black and clipped-white ratios, entropy.
   Catches blackout, snow and lens-cap frames.
2. **Blur** - ratio of high-frequency energy (mean absolute Laplacian response) to
   the global contrast. A defocused or deliberately smeared lens collapses this
   ratio while a sharp frame does not. Scale-invariant, so it survives resizing.
3. **Obstruction** - a covering object produces a large, low-texture region whose
   brightness departs from its surroundings. The frame is reduced to a block grid
   of local-texture and local-brightness features; blocks that are both near-textureless
   and bright enough to stand out are grouped with a flood fill, and the largest group
   becomes the occlusion mask.
4. **Headcount** - real people are blobs. With a previous frame the background is the
   per-pixel temporal median of the two and the motion residual is thresholded, which
   is the classic CCTV foreground extraction. With only one frame it falls back to a
   spectral-residual saliency map (Hou & Zhang 2007), also computed in the frequency
   domain. Either way connected components are filtered by area and aspect ratio.
5. **Tilt** - the dominant gradient orientation of the frame. A camera knocked off its
   mount rotates the scene's dominant edges away from horizontal.

OpenCV is used where it makes the code clearer or faster, but every OpenCV path has a
NumPy equivalent, so the engine still runs when ``opencv-python-headless`` is missing
or its DLLs are blocked by policy.
"""

from __future__ import annotations

import base64
import io
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import numpy as np

try:  # pragma: no cover - import guard, exercised implicitly by the environment
    from PIL import Image

    _PIL = True
except Exception:  # pragma: no cover
    Image = None  # type: ignore[assignment]
    _PIL = False

try:  # pragma: no cover
    import cv2

    _CV2 = True
except Exception:  # pragma: no cover
    cv2 = None  # type: ignore[assignment]
    _CV2 = False


# Analysis geometry. 320x180 is what the simulated renderer emits, so downscaling to
# 320 wide keeps a real frame and a simulated frame on the same footing.
ANALYSIS_WIDTH = 320

# A 3x3 box filter, used for local texture and for the saliency post-filter.
_KERNEL = np.ones((3, 3), dtype=np.float32) / 9.0


# --------------------------------------------------------------------- helpers


def _box_filter(arr: np.ndarray) -> np.ndarray:
    """3x3 box blur with edge-replicated padding."""
    padded = np.pad(arr, 1, mode="edge")
    out = np.zeros_like(arr, dtype=np.float32)
    for dy in range(3):
        for dx in range(3):
            out += padded[dy : dy + arr.shape[0], dx : dx + arr.shape[1]]
    return out / 9.0


def _separable_gaussian(arr: np.ndarray, sigma: float) -> np.ndarray:
    """Small separable Gaussian, so scipy stays out of the dependency list."""
    radius = max(1, int(3 * sigma))
    x = np.arange(-radius, radius + 1, dtype=np.float32)
    kernel = np.exp(-(x**2) / (2.0 * sigma * sigma))
    kernel /= kernel.sum()

    padded = np.pad(arr, ((0, 0), (radius, radius)), mode="edge")
    out = np.zeros_like(arr, dtype=np.float32)
    for i, weight in enumerate(kernel):
        out += weight * padded[:, i : i + arr.shape[1]]
    padded = np.pad(out, ((radius, radius), (0, 0)), mode="edge")
    out = np.zeros_like(arr, dtype=np.float32)
    for i, weight in enumerate(kernel):
        out += weight * padded[i : i + arr.shape[0], :]
    return out


def _entropy(arr: np.ndarray) -> float:
    """Shannon entropy of the 64-bin intensity histogram, in bits."""
    hist, _ = np.histogram(np.clip(arr, 0, 255), bins=64, range=(0, 256))
    total = hist.sum()
    if total <= 0:
        return 0.0
    probs = hist[hist > 0] / total
    return float(-(probs * np.log2(probs)).sum())


def _to_gray_array(source: Any) -> np.ndarray | None:
    """Decodes bytes / path / ndarray into a float32 grayscale array scaled to 0..255."""
    if source is None:
        return None

    if isinstance(source, np.ndarray):
        gray = source
    else:
        if not _PIL:
            return None
        try:
            if isinstance(source, (bytes, bytearray)):
                handle = Image.open(io.BytesIO(bytes(source)))
            else:
                handle = Image.open(source)
            with handle:
                gray = np.asarray(handle.convert("L"), dtype=np.float32)
        except Exception:
            return None

    if gray.size == 0:
        return None

    # Cap the long edge for speed while keeping the aspect ratio.
    if gray.shape[1] > ANALYSIS_WIDTH:
        scale = ANALYSIS_WIDTH / float(gray.shape[1])
        new_w = max(1, int(round(gray.shape[1] * scale)))
        new_h = max(1, int(round(gray.shape[0] * scale)))
        if _CV2 is not None:
            gray = cv2.resize(gray, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:  # pragma: no cover - area averaging by slicing
            ys = (np.arange(new_h) * (gray.shape[0] / new_h)).astype(int)
            xs = (np.arange(new_w) * (gray.shape[1] / new_w)).astype(int)
            gray = gray[np.ix_(ys, xs)]

    return np.ascontiguousarray(gray, dtype=np.float32)


def _to_rgb_array(source: Any) -> np.ndarray | None:
    """Same as :func:`_to_gray_array` but keeps three channels."""
    if isinstance(source, np.ndarray):
        rgb = source
        if rgb.ndim == 2:
            rgb = np.repeat(rgb[:, :, None], 3, axis=2)
        return rgb[:, :, :3].astype(np.float32)

    if not _PIL:
        return None
    try:
        if isinstance(source, (bytes, bytearray)):
            handle = Image.open(io.BytesIO(bytes(source)))
        else:
            handle = Image.open(source)
        with handle:
            rgb = np.asarray(handle.convert("RGB"), dtype=np.float32)
    except Exception:
        return None
    return rgb


def _decode_b64(payload: str | None) -> bytes | None:
    """Accepts a bare base64 string or a ``data:image/...;base64,`` URL."""
    if not payload:
        return None
    raw = payload.strip()
    if raw.startswith("data:"):
        _, _, raw = raw.partition(",")
    if not raw:
        return None
    try:
        return base64.b64decode(raw, validate=False)
    except Exception:
        return None


# ------------------------------------------------------------------- foreground


def _spectral_residual_saliency(gray: np.ndarray) -> np.ndarray:
    """Single-frame saliency map (Hou & Zhang, CVPR 2007), implemented on NumPy.

    Uses the fact that natural image spectra are sparse in the log-magnitude domain:
    the residual after subtracting the local average of the log spectrum isolates the
    structurally unusual regions, which for a facility scene are the people.
    """
    h, w = gray.shape
    size = (h, w)
    spectrum = np.fft.fft2(gray)
    log_amp = np.log(np.abs(spectrum) + 1e-8)
    phase = np.angle(spectrum)

    # Local average of the log-magnitude, box filtered.
    residual = log_amp - _box_filter(log_amp)

    saliency = np.abs(np.fft.ifft2(np.exp(residual + 1j * phase))) ** 2
    saliency = _box_filter(saliency.astype(np.float32))
    saliency = _separable_gaussian(saliency, sigma=4.0)

    lo, hi = float(saliency.min()), float(saliency.max())
    if hi - lo < 1e-9:
        return np.zeros(size, dtype=np.float32)
    return (saliency - lo) / (hi - lo)


def _foreground_mask(gray: np.ndarray, background: np.ndarray | None) -> tuple[np.ndarray, str]:
    """Builds a boolean mask of "something moved or stands out here".

    ``background`` is a per-pixel reference frame the caller maintains (the backend
    keeps a rolling per-camera median). That is the standard CCTV foreground
    extraction: the static scene cancels out and only movers survive. Two frames are
    not enough on their own - the per-pixel median of exactly two frames is their
    mean, which leaves a residual everywhere - so without a real background we fall
    back to single-frame spectral-residual saliency, which is noisier and is reported
    with lower confidence.
    """
    if background is not None and background.shape == gray.shape:
        diff = np.abs(gray - background)

        # Robust noise floor: the sensor grain is uniform, the movers are not, so
        # compare each pixel against its own local spread.
        noise = float(np.median(diff))
        scale = float(np.percentile(diff, 98))
        threshold = max(noise * 4.0 + 2.0, 0.22 * scale)
        return diff > threshold, "background_subtraction"

    saliency = _spectral_residual_saliency(gray)
    # Otsu-ish split: the natural separation point between the flat background
    # band and the bright object band.
    threshold = float(np.mean(saliency) + 2.2 * np.std(saliency))
    return saliency > max(threshold, 0.20), "spectral_residual_saliency"


def _connected_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """Label connected blobs. Uses OpenCV when present, else an iterative flood fill."""
    binary = mask.astype(np.uint8)

    if _CV2 is not None:
        count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        return labels, count

    labels = np.zeros(mask.shape, dtype=np.int32)
    current = 0
    h, w = mask.shape
    for y in range(h):
        for x in range(w):
            if not mask[y, x] or labels[y, x]:
                continue
            current += 1
            stack = [(y, x)]
            labels[y, x] = current
            while stack:
                cy, cx = stack.pop()
                for ny in (cy - 1, cy, cy + 1):
                    for nx in (cx - 1, cx, cx + 1):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                            labels[ny, nx] = current
                            stack.append((ny, nx))
    return labels, current + 1


def _largest_component(mask: np.ndarray) -> np.ndarray:
    """Returns the mask of the single biggest blob - a covering object is one blob."""
    labels, count = _connected_components(mask)
    if count <= 1:
        return np.zeros_like(mask, dtype=bool)

    areas = np.bincount(labels.ravel(), minlength=count)
    areas[0] = 0  # background label
    best = int(np.argmax(areas))
    return labels == best


# ------------------------------------------------------------------- the analyzer


@dataclass
class _Metrics:
    mean_luma: float = 0.0
    std_luma: float = 0.0
    black_pct: float = 0.0
    white_pct: float = 0.0
    entropy: float = 0.0
    hf_ratio: float = 0.0
    occlusion_pct: float = 0.0
    headcount: int = 0
    tilt_degrees: float = 0.0
    dominant_angle: float = 0.0
    backend: str = "numpy"
    source: str = "single_frame"
    width: int = 0
    height: int = 0
    notes: list[str] = field(default_factory=list)


class CCTVAnalyzer:
    """Turns one CCTV frame (optionally paired with its predecessor) into a verdict."""

    # --- thresholds. Calibrated against the renderer in
    # backend/src/services/cctvService.js and against naturally photographed frames.
    BLACKOUT_LUMA = 14.0
    BLACKOUT_PCT = 0.72
    SNOW_STD = 46.0
    BLUR_HF_RATIO = 0.030
    OBSTRUCTION_AREA_PCT = 9.0
    TILT_DEGREES = 12.0
    PERSON_MIN_AREA_FRAC = 0.0012
    PERSON_MAX_AREA_FRAC = 0.2200

    def __init__(self) -> None:
        self.backend = "opencv" if _CV2 else "numpy"

    # -- individual measurements -------------------------------------------

    def _frame_health(self, gray: np.ndarray) -> _Metrics:
        m = _Metrics(backend=self.backend)
        m.width, m.height = int(gray.shape[1]), int(gray.shape[0])
        m.mean_luma = float(gray.mean())
        m.std_luma = float(gray.std())
        m.black_pct = float((gray < 12).mean() * 100.0)
        m.white_pct = float((gray > 243).mean() * 100.0)
        m.entropy = _entropy(gray)

        # High-frequency energy relative to global contrast. Sharp scenes keep a
        # meaningful edge response against their own contrast; defocused ones do not.
        lap = (
            4.0 * gray[1:-1, 1:-1]
            - gray[:-2, 1:-1]
            - gray[2:, 1:-1]
            - gray[1:-1, :-2]
            - gray[1:-1, 2:]
        )
        hf = float(np.abs(lap).mean())
        m.hf_ratio = hf / (m.std_luma + 1e-3)
        return m

    def _obstruction(self, gray: np.ndarray, m: _Metrics) -> float:
        """Percentage of the frame covered by one large, textureless, contrasting blob."""
        h, w = gray.shape
        block = 16
        rows, cols = h // block, w // block
        if rows < 2 or cols < 2:
            return 0.0

        cropped = gray[: rows * block, : cols * block]
        grid = cropped.reshape(rows, block, cols, block)

        texture = np.zeros((rows, cols), dtype=np.float32)
        luma = np.zeros((rows, cols), dtype=np.float32)
        for r in range(rows):
            for c in range(cols):
                tile = grid[r, :, c, :]
                lap = (
                    4.0 * tile[1:-1, 1:-1]
                    - tile[:-2, 1:-1]
                    - tile[2:, 1:-1]
                    - tile[1:-1, :-2]
                    - tile[1:-1, 2:]
                )
                texture[r, c] = float(np.abs(lap).mean())
                luma[r, c] = float(tile.mean())

        # A covering object is *both* near-textureless *and* offset from the scene's
        # overall brightness. Requiring both rejects flat but in-focus sky or wall.
        texture_cut = max(2.2, float(np.percentile(texture, 22)))
        global_luma = float(luma.mean())
        # Relative contrast cut, so the same threshold works for a dusk frame and a
        # bright midday one.
        luma_cut = float(np.mean(np.abs(luma - global_luma)) + 1e-3)

        candidate = (texture < texture_cut) & (np.abs(luma - global_luma) > luma_cut * 1.5)

        if not candidate.any():
            return 0.0

        coverage = float(candidate.mean() * 100.0)
        if coverage < self.OBSTRUCTION_AREA_PCT:
            return 0.0

        # Group the candidate blocks into connected regions and keep only the largest.
        region = _largest_component(candidate)
        area_pct = float(region.mean() * 100.0)

        # Confirm the region really is an obstruction and not a textured-but-dim wall:
        # its internal texture must be far below the frame's own texture median.
        internal_texture = float(texture[region].mean()) if region.any() else 0.0
        frame_texture = float(np.median(texture))
        if frame_texture > 0 and internal_texture > frame_texture * 0.45:
            return 0.0

        m.notes.append(
            f"obstruction blob covers {area_pct:.1f}% of frame "
            f"(contrast {luma_cut:.1f} luma, internal texture {internal_texture:.2f})"
        )
        return area_pct

    def _tilt(self, gray: np.ndarray) -> tuple[float, float]:
        """Dominant edge orientation and how far it sits from horizontal."""
        gy, gx = np.gradient(gray)
        magnitude = np.hypot(gx, gy)

        # Restrict to the strongest edges: scene structure dominates orientation,
        # sensor noise contributes uniformly and would wash the peak out.
        cutoff = float(np.percentile(magnitude, 92))
        if cutoff < 1e-3:
            return 0.0, 0.0
        strong = magnitude >= cutoff

        angles = np.degrees(np.arctan2(gy[strong], gx[strong]))
        # Structures are undirected, so fold into [0, 90).
        folded = np.mod(angles, 90.0)

        hist, edges = np.histogram(folded, bins=45, range=(0.0, 90.0))
        peak = int(np.argmax(hist))
        dominant = float((edges[peak] + edges[peak + 1]) / 2.0)
        # Distance from horizontal, folded into [0, 45].
        deviation = abs(dominant - 0.0)
        deviation = min(deviation, 90.0 - deviation)
        return dominant, float(deviation)

    def _headcount(self, gray: np.ndarray, background: np.ndarray | None) -> tuple[int, str]:
        mask, source = _foreground_mask(gray, background)
        if mask.sum() == 0:
            return 0, source

        # Saliency blobs are fuzzier and pick up scene structure, so it needs a harder
        # threshold than a clean motion mask.
        min_fill = 0.34 if source == "spectral_residual_saliency" else 0.28
        min_height = 3.0 if source == "spectral_residual_saliency" else 2.0

        cleaned = _box_filter(mask.astype(np.float32)) > 0.30
        if cleaned.sum() == 0:
            return 0, source

        labels, count = _connected_components(cleaned)
        if count <= 1:
            return 0, source

        frame_area = float(gray.shape[0] * gray.shape[1])
        lo = self.PERSON_MIN_AREA_FRAC * frame_area
        hi = self.PERSON_MAX_AREA_FRAC * frame_area

        people = 0
        for label in range(1, count):
            component = labels == label
            area = float(component.sum())
            if not (lo <= area <= hi):
                continue
            ys, xs = np.nonzero(component)
            h_box = float(ys.max() - ys.min() + 1)
            w_box = float(xs.max() - xs.min() + 1)
            if h_box < min_height or w_box <= 0:
                continue
            aspect = h_box / w_box
            fill = area / (h_box * w_box)
            # Upright, reasonably solid silhouettes; wide flat blobs are usually
            # shadows or a door sliding open.
            if 1.0 <= aspect <= 5.0 and fill >= min_fill:
                people += 1
        return people, source

    # -- public entry point ------------------------------------------------

    def analyze(
        self,
        image: Any,
        background_image: Any = None,
        camera_id: int | str | None = None,
    ) -> dict[str, Any]:
        """Runs the full pipeline and returns the verdict dict the API contract expects."""
        if isinstance(image, str):
            raw = _decode_b64(image)
            gray = _to_gray_array(raw) if raw is not None else _to_gray_array(image)
        else:
            gray = _to_gray_array(image)

        if gray is None:
            return {
                "camera_id": camera_id,
                "is_anomaly": True,
                "anomaly_type": "unreadable_frame",
                "occlusion_pct": 100.0,
                "detected_headcount": None,
                "severity": "medium",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "recommendation": "Camera returned an unreadable frame - dispatch an engineer",
                "metrics": {"headcount_confidence": 0.0},
                "cv_backend": self.backend,
            }

        background = (
            _to_gray_array(background_image)
            if background_image is not None
            else None
        )

        m = self._frame_health(gray)
        m.occlusion_pct = self._obstruction(gray, m)
        m.dominant_angle, m.tilt_degrees = self._tilt(gray)
        m.headcount, m.source = self._headcount(gray, background)

        anomaly_type, severity, is_anomaly, recommendation = self._classify(m)
        confidence = 0.85 if m.source == "background_subtraction" else 0.5

        return {
            "camera_id": camera_id,
            "is_anomaly": is_anomaly,
            "anomaly_type": anomaly_type,
            "occlusion_pct": round(m.occlusion_pct, 2),
            "detected_headcount": int(m.headcount),
            "severity": severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "recommendation": recommendation,
            "metrics": {
                "mean_luma": round(m.mean_luma, 2),
                "std_luma": round(m.std_luma, 2),
                "black_pct": round(m.black_pct, 2),
                "white_pct": round(m.white_pct, 2),
                "entropy": round(m.entropy, 3),
                "hf_ratio": round(m.hf_ratio, 4),
                "obstruction_pct": round(m.occlusion_pct, 2),
                "headcount": int(m.headcount),
                "headcount_confidence": confidence,
                "tilt_degrees": round(m.tilt_degrees, 2),
                "dominant_angle_degrees": round(m.dominant_angle, 2),
                "frame_size": f"{m.width}x{m.height}",
                "foreground_source": m.source,
                "notes": m.notes,
            },
            "cv_backend": self.backend,
        }

    def _classify(self, m: _Metrics) -> tuple[str, str, bool, str]:
        """Maps the measurements onto an anomaly type. Order matters: the most
        damning failure wins, because a camera that is both blacked out and tilted
        should be reported as blacked out."""
        if m.black_pct / 100.0 >= self.BLACKOUT_PCT and m.mean_luma < self.BLACKOUT_LUMA:
            return "camera_blackout", "high", True, "Lens covered or feed lost - dispatch an engineer"

        if m.occlusion_pct >= self.OBSTRUCTION_AREA_PCT:
            return "lens_obstruction", "high", True, (
                "Lens obstructed - raise an instant physical verification with live VC"
            )

        if m.std_luma >= self.SNOW_STD and m.entropy < 3.2:
            return "signal_noise_snow", "medium", True, (
                "Severe frame noise suggests a failing sensor or a cut cable"
            )

        if m.hf_ratio < self.BLUR_HF_RATIO:
            return "lens_blur_defocus", "medium", True, (
                "Frame has lost focus - the lens may have been defocused or smeared"
            )

        if m.tilt_degrees >= self.TILT_DEGREES:
            return "camera_angle_tamper", "medium", True, (
                "Scene is rotated away from its mounting angle - verify camera placement"
            )

        if m.white_pct > 55.0:
            return "lens_glare", "low", True, "Severe glare - confirm the lens is clean"

        return "normal", "low", False, "No obstruction or tamper signal detected"


cctv_analyzer = CCTVAnalyzer()
