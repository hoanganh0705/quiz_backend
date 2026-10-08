const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const JPEG_SOI = [0xff, 0xd8, 0xff] as const;
const GIF87A = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61] as const;
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const;
const WEBP_RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_WEBP = [0x57, 0x45, 0x42, 0x50] as const;

export const SUPPORTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type SupportedImageMime = (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

const startsWith = (buffer: Buffer, signature: readonly number[]): boolean => {
  if (buffer.length < signature.length) {
    return false;
  }
  for (let i = 0; i < signature.length; i++) {
    if (buffer[i] !== signature[i]) {
      return false;
    }
  }
  return true;
};

export const detectImageMimeFromBuffer = (
  buffer: Buffer | undefined | null,
): SupportedImageMime | null => {
  if (!buffer || buffer.length === 0) {
    return null;
  }

  if (startsWith(buffer, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(buffer, JPEG_SOI)) {
    return 'image/jpeg';
  }
  if (startsWith(buffer, GIF87A) || startsWith(buffer, GIF89A)) {
    return 'image/gif';
  }
  if (
    startsWith(buffer, WEBP_RIFF) &&
    buffer.length >= 12 &&
    startsWith(buffer.subarray(8, 12), WEBP_WEBP)
  ) {
    return 'image/webp';
  }

  return null;
};
