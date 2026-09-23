import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';

import { UploadFileRequestDto } from './upload-file.request.dto';
import { SignUploadRequestDto } from './sign-upload.request.dto';
import { BindUploadRequestDto } from './bind-upload.request.dto';

describe('Upload request DTOs', () => {
  describe('UploadFileRequestDto', () => {
    it('accepts a valid avatar purpose', async () => {
      const dto = plainToInstance(UploadFileRequestDto, { purpose: 'avatar' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts a valid quiz purpose', async () => {
      const dto = plainToInstance(UploadFileRequestDto, { purpose: 'quiz' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown purpose', async () => {
      const dto = plainToInstance(UploadFileRequestDto, { purpose: 'unknown' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const constraintMessages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
      expect(constraintMessages).toContain('purpose must be one of: avatar, quiz');
    });

    it('rejects a missing purpose', async () => {
      const dto = plainToInstance(UploadFileRequestDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a non-string purpose', async () => {
      const dto = plainToInstance(UploadFileRequestDto, { purpose: 123 });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('SignUploadRequestDto', () => {
    it('accepts a valid purpose without expiresInSeconds', async () => {
      const dto = plainToInstance(SignUploadRequestDto, { purpose: 'avatar' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('accepts a valid purpose with expiresInSeconds within range', async () => {
      const dto = plainToInstance(SignUploadRequestDto, {
        purpose: 'avatar',
        expiresInSeconds: 300,
      });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects expiresInSeconds below the floor', async () => {
      const dto = plainToInstance(SignUploadRequestDto, {
        purpose: 'avatar',
        expiresInSeconds: 10,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects expiresInSeconds above the ceiling', async () => {
      const dto = plainToInstance(SignUploadRequestDto, {
        purpose: 'avatar',
        expiresInSeconds: 7200,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a non-integer expiresInSeconds', async () => {
      const dto = plainToInstance(SignUploadRequestDto, {
        purpose: 'avatar',
        expiresInSeconds: 100.5,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects an unknown purpose', async () => {
      const dto = plainToInstance(SignUploadRequestDto, { purpose: 'unknown' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('BindUploadRequestDto', () => {
    it('accepts a valid purpose', async () => {
      const dto = plainToInstance(BindUploadRequestDto, { purpose: 'avatar' });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    });

    it('rejects an unknown purpose', async () => {
      const dto = plainToInstance(BindUploadRequestDto, { purpose: 'unknown' });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('rejects a missing purpose', async () => {
      const dto = plainToInstance(BindUploadRequestDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
