export type UploadPurpose = 'avatar' | 'quiz';

export interface UploadInput {
  readonly buffer: Buffer;
  readonly mime: string;
  readonly bytes: number;
  readonly purpose: UploadPurpose;
  readonly ownerId: string;
}

export interface UploadResult {
  readonly publicId: string;
  readonly url: string;
  readonly bytes: number;
  readonly format: string;
  readonly width: number;
  readonly height: number;
}

export interface SignedUpload {
  readonly uploadUrl: string;
  readonly publicId: string;
  readonly expiresAt: string;
  readonly apiKey: string;
  readonly signature: string;
  readonly timestamp: number;
  readonly folder: string;
}

export interface StoragePort {
  upload(input: UploadInput): Promise<UploadResult>;
  delete(publicId: string): Promise<void>;
  deriveUrl(publicId: string, purpose: UploadPurpose): string;

  ping(): Promise<void>;
  createSignedUpload(input: {
    readonly ownerId: string;
    readonly purpose: UploadPurpose;
    readonly expiresInSeconds: number;
  }): Promise<SignedUpload>;
}
