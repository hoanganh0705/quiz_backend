import { ConfigType, registerAs } from '@nestjs/config';

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
  apiKey: process.env.CLOUDINARY_API_KEY ?? '',
  apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  folder: process.env.CLOUDINARY_FOLDER ?? 'quiz-app-dev',
}));

export type CloudinaryConfig = ConfigType<typeof cloudinaryConfig>;
