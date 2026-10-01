import fs from 'fs';
import zlib from 'zlib';

function createPNG(size) {
  const width = size;
  const height = size;

  // Raw RGBA pixel buffer
  const rgba = Buffer.alloc(width * height * 4);

  const radius = Math.floor(size * 0.42);
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Dark background with subtle rounded border / circle
      if (dist <= radius) {
        // Crisp white glyph / icon center
        const innerDist = Math.abs(dist - radius * 0.7);
        if (innerDist <= Math.max(1, size * 0.08) || (Math.abs(dx) < size * 0.15 && dy > -size * 0.25 && dy < size * 0.25)) {
          rgba[idx] = 255;     // R
          rgba[idx + 1] = 255; // G
          rgba[idx + 2] = 255; // B
          rgba[idx + 3] = 255; // A
        } else {
          rgba[idx] = 18;      // R
          rgba[idx + 1] = 18;  // G
          rgba[idx + 2] = 21;  // B
          rgba[idx + 3] = 255; // A
        }
      } else {
        // Outer dark background #09090b
        rgba[idx] = 9;
        rgba[idx + 1] = 9;
        rgba[idx + 2] = 11;
        rgba[idx + 3] = 255;
      }
    }
  }

  // PNG scanlines with filter byte 0 (None)
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const scanlineOffset = y * (width * 4 + 1);
    scanlines[scanlineOffset] = 0; // Filter: None
    rgba.copy(scanlines, scanlineOffset + 1, y * width * 4, (y + 1) * width * 4);
  }

  const idatData = zlib.deflateSync(scanlines);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // Helper for CRC32
  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
    }
    crcTable[i] = c >>> 0;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: RGBA
  ihdr[10] = 0; // Compression: Deflate
  ihdr[11] = 0; // Filter: Standard
  ihdr[12] = 0; // Interlace: None

  const ihdrChunk = makeChunk('IHDR', ihdr);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

for (const size of [16, 48, 128]) {
  const png = createPNG(size);
  fs.writeFileSync(`extension/icons/icon-${size}.png`, png);
  console.log(`Generated extension/icons/icon-${size}.png (${size}x${size}, ${png.length} bytes)`);
}
