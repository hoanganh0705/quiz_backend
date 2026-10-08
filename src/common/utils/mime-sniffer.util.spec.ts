import { detectImageMimeFromBuffer, SUPPORTED_IMAGE_MIME_TYPES } from './mime-sniffer.util';

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF87A_BYTES = Buffer.from('GIF87a', 'ascii');
const GIF89A_BYTES = Buffer.from('GIF89a', 'ascii');
const WEBP_BYTES = (() => {
  const riff = Buffer.from('RIFF', 'ascii');
  const size = Buffer.from([0x1a, 0x00, 0x00, 0x00]);
  const webp = Buffer.from('WEBP', 'ascii');
  return Buffer.concat([riff, size, webp, Buffer.from('VP8 ', 'ascii')]);
})();

describe('detectImageMimeFromBuffer', () => {
  it('detects PNG from magic bytes', () => {
    expect(detectImageMimeFromBuffer(PNG_BYTES)).toBe('image/png');
  });

  it('detects JPEG from SOI marker', () => {
    expect(detectImageMimeFromBuffer(JPEG_BYTES)).toBe('image/jpeg');
  });

  it('detects GIF87a header', () => {
    expect(detectImageMimeFromBuffer(GIF87A_BYTES)).toBe('image/gif');
  });

  it('detects GIF89a header', () => {
    expect(detectImageMimeFromBuffer(GIF89A_BYTES)).toBe('image/gif');
  });

  it('detects WebP via RIFF + WEBP box at offset 8', () => {
    expect(detectImageMimeFromBuffer(WEBP_BYTES)).toBe('image/webp');
  });

  it('returns null for empty buffer', () => {
    expect(detectImageMimeFromBuffer(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for null/undefined input', () => {
    expect(detectImageMimeFromBuffer(null)).toBeNull();
    expect(detectImageMimeFromBuffer(undefined)).toBeNull();
  });

  it('returns null when bytes do not match any known signature', () => {
    const elfHeader = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
    expect(detectImageMimeFromBuffer(elfHeader)).toBeNull();
  });

  it('returns null for truncated buffers shorter than a signature', () => {
    expect(detectImageMimeFromBuffer(Buffer.from([0x89]))).toBeNull();
  });

  it('returns null when RIFF header is present but the WEBP box is missing', () => {
    const riffOnly = Buffer.from('RIFXXXXX', 'ascii');
    expect(detectImageMimeFromBuffer(riffOnly)).toBeNull();
  });

  it('lists exactly four supported MIME types', () => {
    expect(SUPPORTED_IMAGE_MIME_TYPES).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
    ]);
  });
});
