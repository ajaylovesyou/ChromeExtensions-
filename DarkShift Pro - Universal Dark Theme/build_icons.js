const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  const crc = crc32(typeAndData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

function createPng(width, height, pixelFn) {
  const scanlines = Buffer.alloc(height * (1 + width * 4));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    scanlines[offset++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFn(x, y, width, height);
      scanlines[offset++] = r;
      scanlines[offset++] = g;
      scanlines[offset++] = b;
      scanlines[offset++] = a;
    }
  }

  const deflated = zlib.deflateSync(scanlines);

  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8-bit depth
  ihdr[9] = 6; // RGBA color type
  ihdr[10] = 0; // Deflate compression
  ihdr[11] = 0; // Filter method
  ihdr[12] = 0; // Interlace: None

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Icon drawer: Smooth antialiased circular badge + crescent moon + sparkles
function drawDarkShiftIcon(x, y, w, h) {
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const r = (w - 1) * 0.46;

  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Background circle mask
  if (dist > r + 0.5) {
    return [0, 0, 0, 0]; // Transparent outside circle
  }

  let alpha = 255;
  if (dist > r - 0.5) {
    // Antialiased edge
    alpha = Math.round(255 * (r + 0.5 - dist));
  }

  // Base background gradient: Deep navy to violet dark (#0f172a to #1e1b4b)
  const t = (y / h + x / w) / 2;
  let bgR = Math.round(15 * (1 - t) + 30 * t);
  let bgG = Math.round(23 * (1 - t) + 27 * t);
  let bgB = Math.round(42 * (1 - t) + 75 * t);

  // Border ring highlight
  if (dist >= r - 1.5 && dist <= r) {
    bgR = Math.round(bgR * 0.4 + 99 * 0.6);
    bgG = Math.round(bgG * 0.4 + 102 * 0.6);
    bgB = Math.round(bgB * 0.4 + 241 * 0.6);
  }

  // Moon Crescent calculation
  // Moon center 1: main body
  const moonCx = cx - w * 0.05;
  const moonCy = cy;
  const moonR = w * 0.28;
  const dMoon1 = Math.sqrt((x - moonCx) ** 2 + (y - moonCy) ** 2);

  // Moon center 2: cutout
  const cutCx = cx + w * 0.12;
  const cutCy = cy - h * 0.08;
  const cutR = w * 0.25;
  const dCut = Math.sqrt((x - cutCx) ** 2 + (y - cutCy) ** 2);

  // In moon if inside moon1 AND outside cut
  const inMoon1 = dMoon1 <= moonR;
  const outCut = dCut >= cutR;

  if (inMoon1 && outCut) {
    // Soft anti-aliasing on moon boundary
    const edgeDist = Math.min(moonR - dMoon1, dCut - cutR);
    const moonFactor = Math.min(1, Math.max(0, edgeDist + 0.5));

    // Glowing cyan-indigo-purple gradient on moon
    const moonT = ((x - (moonCx - moonR)) / (moonR * 2));
    const mR = Math.round(129 * (1 - moonT) + 56 * moonT);
    const mG = Math.round(140 * (1 - moonT) + 189 * moonT);
    const mB = Math.round(248 * (1 - moonT) + 248 * moonT);

    bgR = Math.round(bgR * (1 - moonFactor) + mR * moonFactor);
    bgG = Math.round(bgG * (1 - moonFactor) + mG * moonFactor);
    bgB = Math.round(bgB * (1 - moonFactor) + mB * moonFactor);
  }

  // Star accent for icons >= 32px
  if (w >= 32) {
    const starX = cx + w * 0.25;
    const starY = cy - h * 0.22;
    const dStar = Math.abs(x - starX) + Math.abs(y - starY);
    const starSize = w * 0.10;
    if (dStar <= starSize) {
      const starFactor = 1 - (dStar / starSize);
      bgR = Math.round(bgR * (1 - starFactor) + 250 * starFactor);
      bgG = Math.round(bgG * (1 - starFactor) + 204 * starFactor);
      bgB = Math.round(bgB * (1 - starFactor) + 21 * starFactor);
    }
  }

  return [bgR, bgG, bgB, alpha];
}

const outDir = path.join('E:', 'Goal', 'Extension', 'DarkShift Pro - Universal Dark Theme', 'icons');
[16, 32, 48, 128].forEach(size => {
  const pngBuf = createPng(size, size, drawDarkShiftIcon);
  const target = path.join(outDir, `icon${size}.png`);
  fs.writeFileSync(target, pngBuf);
  console.log(`Generated: ${target} (${size}x${size}, ${pngBuf.length} bytes)`);
});
