/**
 * CCTV frame service.
 *
 * Real site CCTV is usually RTSP/HLS behind credentials, which a browser cannot
 * open directly. This service supports two modes:
 *
 *   1. `simulated` (default) - renders a deterministic, *moving* PNG frame per
 *      camera with zero dependencies (pure Node + zlib). The frame changes on
 *      every request so the client sees a genuine live feed. This is what makes
 *      the demo work with no camera and no API key.
 *   2. `mjpeg` / `hls` - proxies a real HTTP snapshot source through the API so
 *      the browser stays same-origin (no CORS / mixed-content problems).
 */
const zlib = require('zlib');
const https = require('https');
const http = require('http');

const FRAME_WIDTH = 320;
const FRAME_HEIGHT = 180;

/* --------------------------------------------------------------- PNG codec */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let crc = -1;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
};

const pngChunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
};

/** Encodes an 8-bit truecolour RGB pixel buffer into a PNG image. */
const encodePng = (width, height, rgb) => {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Prefix every scanline with filter type 0 (None).
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
};

/* --------------------------------------------------------- frame rendering */

const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Cheap deterministic PRNG so a given camera always looks the same. */
const seededRandom = (seed) => {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
};

const buildScene = (camera, width, height) => {
  const rand = seededRandom(hashString(`${camera.name}#${camera.id}`));
  const buildings = [];
  const count = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < count; i += 1) {
    buildings.push({
      x: Math.floor(rand() * width),
      width: 18 + Math.floor(rand() * 40),
      height: 24 + Math.floor(rand() * 70),
      shade: 70 + Math.floor(rand() * 50),
    });
  }
  // A couple of moving actors so consecutive frames visibly differ.
  const actors = [];
  const actorCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < actorCount; i += 1) {
    actors.push({
      offset: rand() * 1000,
      speed: 12 + rand() * 26, // px per second
      y: height - 22 - Math.floor(rand() * 14),
      size: 4 + Math.floor(rand() * 3),
    });
  }
  return { buildings, actors };
};

const sceneCache = new Map();

const getScene = (camera, width, height) => {
  const key = `${camera.id}:${camera.name}:${width}x${height}`;
  if (!sceneCache.has(key)) sceneCache.set(key, buildScene(camera, width, height));
  return sceneCache.get(key);
};

const clamp255 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
/**
 * Renders one "camera frame". `at` (ms epoch) drives all motion so the output
 * is reproducible for a given timestamp.
 *
 * `scenario` injects a physical fault into the pixels (covered lens, blackout,
 * defocus, a knocked-off mount). The AI engine reads those pixels back and reports
 * what it actually found - the scenario is not a label the client passes through,
 * it is a change to the image the detector has to earn its verdict from.
 */
const renderFrame = (
  camera,
  at = Date.now(),
  width = FRAME_WIDTH,
  height = FRAME_HEIGHT,
  scenario = null,
) => {
  const rgb = Buffer.alloc(width * height * 3);
  const { buildings, actors } = getScene(camera, width, height);
  const t = at / 1000;
  const horizon = Math.floor(height * 0.62);
  const noise = Math.floor((at / 250) % 7); // cheap per-frame dither
  const dusk = (Math.sin(t / 45) + 1) / 2; // slow ambient light drift

  // A physical fault lives in frame space rather than in the scene description,
  // so it is applied to the finished buffer below.
  const fault = FAULTS[scenario] || null;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r;
      let g;
      let b;

      if (y < horizon) {
        // Sky gradient with a slow cloud band
        const skyT = y / horizon;
        r = 108 + skyT * 96 - dusk * 12;
        g = 146 + skyT * 72 - dusk * 8;
        b = 186 + skyT * 54;
        const cloud = Math.sin(x / 34 + t / 6) * Math.cos(y / 26 - t / 9);
        if (cloud > 0.55) {
          const lift = (cloud - 0.55) * 90;
          r += lift;
          g += lift;
          b += lift;
        }
      } else {
        // Ground with a road strip and moving lane markings
        const groundT = (y - horizon) / (height - horizon);
        r = 92 + groundT * 26;
        g = 104 + groundT * 20;
        b = 78 + groundT * 14;
        if (groundT > 0.42) {
          const shade = 70 - groundT * 12;
          r = shade;
          g = shade + 2;
          b = shade + 6;
          if ((x + Math.floor(t * 26)) % 48 < 18) {
            r += 96;
            g += 92;
            b += 78;
          }
        }
      }

      // Buildings with randomly lit windows
      for (const building of buildings) {
        if (x >= building.x && x < building.x + building.width && y >= horizon - building.height && y < horizon) {
          const depth = (y - (horizon - building.height)) / building.height;
          const shade = building.shade + depth * 60;
          r = shade;
          g = shade + 6;
          b = shade + 14;
          if (x % 9 < 4 && y % 8 < 3 && (x + y + Math.floor(t / 8)) % 11 < 3) {
            r += 120;
            g += 96;
            b += 40;
          }
        }
      }

      // Moving actors
      for (const actor of actors) {
        const ax = ((actor.offset + t * actor.speed) % (width + 60)) - 30;
        const dy = y - actor.y;
        if (Math.abs(x - ax) <= actor.size && dy >= -actor.size * 3 && dy <= 0) {
          r = 40;
          g = 44;
          b = 52;
        }
      }

      // CCTV scanlines + sensor grain
      if (y % 3 === 0) {
        r *= 0.93;
        g *= 0.93;
        b *= 0.93;
      }
      const grain = (((x * 7 + y * 13 + noise * 31) % 17) - 8) * 0.9;
      r += grain;
      g += grain;
      b += grain;

      // Vignette
      const cx = (x - width / 2) / (width / 2);
      const cy = (y - height / 2) / (height / 2);
      const vig = 1 - Math.min(0.42, (cx * cx + cy * cy) * 0.3);
      r *= vig;
      g *= vig;
      b *= vig;

      const offset = (y * width + x) * 3;
      rgb[offset] = clamp255(r);
      rgb[offset + 1] = clamp255(g);
      rgb[offset + 2] = clamp255(b);
    }
  }

  // Faults are applied to the finished buffer, not inline above, so each one is a
  // real full-frame image transform the detector has to measure for itself.
  let out = rgb;
  if (fault) {
    out = fault.apply(out, width, height);
  }
  if (scenario === 'defocus') {
    out = boxBlurRgb(out, width, height, 3);
  }

  return encodePng(width, height, out);
};

/**
 * Physical faults a simulated camera can develop. Each one is expressed as a
 * full-frame image transform, so the AI engine's obstruction / blur / blackout
 * tests see genuine pixel evidence rather than a label the caller supplied.
 */
const FAULTS = {
  // Lens cap or cloth thrown over the housing: a large, dark, softly-shaded disc
  // carrying its own weave so the detector's texture test has something real to
  // measure.
  covered: (rgb, width, height) => {
    const radius = Math.min(width, height) * 0.46;
    const cx = width * 0.5;
    const cy = height * 0.5;
    return overlayDisc(rgb, width, height, cx, cy, radius, {
      color: [26, 24, 30],
      edge: 0.16,
      shade: 0.4,
      texture: (x, y) => (((x * 23 + y * 17) % 11) - 5) * 1.4 + Math.sin(x / 5) * 3,
    });
  },

  // A sheet of paper taped over the lens: bright, almost textureless.
  papered: (rgb, width, height) => {
    const radius = Math.min(width, height) * 0.4;
    return overlayDisc(rgb, width, height, width * 0.42, height * 0.46, radius, {
      color: [206, 203, 194],
      edge: 0.12,
      shade: 0.15,
      texture: null,
    });
  },

  // Total feed loss.
  blackout: (rgb, width, height) => {
    for (let i = 0; i < width * height; i += 1) {
      rgb[i * 3] = 3;
      rgb[i * 3 + 1] = 3;
      rgb[i * 3 + 2] = 4;
    }
    return rgb;
  },

  // Failing sensor: heavy luminance noise across the whole frame.
  snow: (rgb, width, height) => {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const n = Math.abs((Math.sin((x / width) * 977 + (y / height) * 1319) * 43758.5453) % 1);
        const val = clamp255(60 + n * 190);
        const offset = (y * width + x) * 3;
        rgb[offset] = val;
        rgb[offset + 1] = val;
        rgb[offset + 2] = val;
      }
    }
    return rgb;
  },
};

/** Blends a soft-edged disc over the buffer, with optional per-pixel texture. */
const overlayDisc = (rgb, width, height, cx, cy, radius, opts) => {
  const { color, edge, shade, texture } = opts;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= radius) continue;

      // Feathered rim, so the occluder boundary is a gradient rather than a step.
      const alpha = Math.min(1, (radius - dist) / (radius * edge));
      const falloff = 1 - Math.min(1, dist / radius) * shade;
      const noise = texture ? texture(x, y) : 0;

      const offset = (y * width + x) * 3;
      for (let ch = 0; ch < 3; ch += 1) {
        const target = color[ch] * falloff + noise;
        rgb[offset + ch] = clamp255(rgb[offset + ch] + (target - rgb[offset + ch]) * alpha);
      }
    }
  }
  return rgb;
};

/** Separable box blur over an RGB buffer; three passes approximate a Gaussian. */
const boxBlurRgb = (rgb, width, height, radius, passes = 2) => {
  let src = Buffer.from(rgb);
  const dst = Buffer.from(rgb);
  for (let p = 0; p < passes; p += 1) {
    for (let ch = 0; ch < 3; ch += 1) {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let sum = 0;
          let n = 0;
          for (let k = -radius; k <= radius; k += 1) {
            const xx = x + k;
            if (xx < 0 || xx >= width) continue;
            sum += src[(y * width + xx) * 3 + ch];
            n += 1;
          }
          dst[(y * width + x) * 3 + ch] = Math.round(sum / n);
        }
      }
      src.set(dst);
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          let sum = 0;
          let n = 0;
          for (let k = -radius; k <= radius; k += 1) {
            const yy = y + k;
            if (yy < 0 || yy >= height) continue;
            sum += src[(yy * width + x) * 3 + ch];
            n += 1;
          }
          dst[(y * width + x) * 3 + ch] = Math.round(sum / n);
        }
      }
      src.set(dst);
    }
  }
  return src;
};

/** Proxies a real camera snapshot (http/https) so the browser stays same-origin. */
const proxySnapshot = (streamUrl, timeoutMs = 6000) =>
  new Promise((resolve) => {
    if (!streamUrl) {
      resolve(null);
      return;
    }
    let parsed;
    try {
      parsed = new URL(streamUrl);
    } catch (err) {
      resolve(null);
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const request = client.get(parsed, { timeout: timeoutMs }, (response) => {
      const contentType = response.headers['content-type'] || 'image/jpeg';
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        proxySnapshot(new URL(response.headers.location, streamUrl).toString(), timeoutMs).then(resolve);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        resolve(null);
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 4 * 1024 * 1024) {
          request.destroy();
          resolve(null);
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (!chunks.length || !/^image\//.test(contentType)) {
          resolve(null);
          return;
        }
        resolve({ contentType, buffer: Buffer.concat(chunks) });
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve(null);
    });
    request.on('error', () => resolve(null));
  });

module.exports = { renderFrame, proxySnapshot, encodePng, FRAME_WIDTH, FRAME_HEIGHT };
