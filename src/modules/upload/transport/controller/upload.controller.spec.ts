/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { UploadController } from './upload.controller';
import { UploadApplicationService } from '../../application/upload.application.service';
import type { JwtPayload } from '@/common/guards/jwt.guard';

const user: JwtPayload = { sub: 'u1', role: 'user' };

const makeUploadAppService = (): UploadApplicationService => {
  return {
    uploadAvatarOrQuizCover: jest.fn(),
    signUpload: jest.fn(),
    bindAsset: jest.fn(),
  } as unknown as UploadApplicationService;
};

const makeFile = (): Express.Multer.File => ({
  fieldname: 'file',
  originalname: 'avatar.png',
  encoding: '7bit',
  mimetype: 'image/png',
  size: 1024,
  buffer: Buffer.from('fake-png-bytes'),
  destination: '',
  filename: '',
  path: '',
  stream: undefined as never,
});

describe('UploadController', () => {
  describe('upload', () => {
    it('maps the storage result into the response DTO with the request purpose', async () => {
      const appService = makeUploadAppService();
      (appService.uploadAvatarOrQuizCover as jest.Mock).mockResolvedValue({
        publicId: 'quiz-app/avatars/u1/abc',
        url: 'https://cdn.test/quiz-app/avatars/u1/abc',
        bytes: 2048,
        format: 'webp',
        width: 1024,
        height: 1024,
      });

      const controller = new UploadController(appService);
      const result = await controller.upload(user, { purpose: 'avatar' }, makeFile());

      expect(result).toEqual({
        publicId: 'quiz-app/avatars/u1/abc',
        url: 'https://cdn.test/quiz-app/avatars/u1/abc',
        bytes: 2048,
        format: 'webp',
        width: 1024,
        height: 1024,
        purpose: 'avatar',
      });
      expect(appService.uploadAvatarOrQuizCover).toHaveBeenCalledWith({
        ownerId: 'u1',
        purpose: 'avatar',
        file: expect.objectContaining({ mimetype: 'image/png' }),
      });
    });

    it('forwards quiz purpose unchanged', async () => {
      const appService = makeUploadAppService();
      (appService.uploadAvatarOrQuizCover as jest.Mock).mockResolvedValue({
        publicId: 'quiz-app/quizzes/u1/abc',
        url: 'https://cdn.test/quiz-app/quizzes/u1/abc',
        bytes: 4096,
        format: 'png',
        width: 1600,
        height: 900,
      });

      const controller = new UploadController(appService);
      const result = await controller.upload(user, { purpose: 'quiz' }, makeFile());

      expect(result.purpose).toBe('quiz');
      expect(appService.uploadAvatarOrQuizCover).toHaveBeenCalledWith({
        ownerId: 'u1',
        purpose: 'quiz',
        file: expect.objectContaining({ mimetype: 'image/png' }),
      });
    });
  });

  describe('signUpload', () => {
    it('forwards ownerId, purpose, and passes through expiresInSeconds when present', async () => {
      const appService = makeUploadAppService();
      (appService.signUpload as jest.Mock).mockResolvedValue({
        uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
        publicId: 'quiz-app/avatars/u1/signed',
        expiresAt: '2026-01-01T00:00:00.000Z',
        apiKey: 'k',
        signature: 's',
        timestamp: 1_700_000_000,
        folder: 'quiz-app/avatars',
      });

      const controller = new UploadController(appService);
      const result = await controller.signUpload(user, {
        purpose: 'avatar',
        expiresInSeconds: 300,
      });

      expect(result.publicId).toBe('quiz-app/avatars/u1/signed');
      expect(appService.signUpload).toHaveBeenCalledWith({
        ownerId: 'u1',
        purpose: 'avatar',
        expiresInSeconds: 300,
      });
    });

    it('omits expiresInSeconds from the service call when undefined', async () => {
      const appService = makeUploadAppService();
      (appService.signUpload as jest.Mock).mockResolvedValue({
        uploadUrl: 'u',
        publicId: 'p',
        expiresAt: 'e',
        apiKey: 'k',
        signature: 's',
        timestamp: 1,
        folder: 'f',
      });

      const controller = new UploadController(appService);
      await controller.signUpload(user, { purpose: 'quiz' });

      const callArgs = (appService.signUpload as jest.Mock).mock.calls[0][0];
      expect(callArgs).toEqual({ ownerId: 'u1', purpose: 'quiz' });
      expect(callArgs).not.toHaveProperty('expiresInSeconds');
    });
  });

  describe('bindUpload', () => {
    it('calls the bind service and returns the success envelope', async () => {
      const appService = makeUploadAppService();
      (appService.bindAsset as jest.Mock).mockResolvedValue(undefined);

      const controller = new UploadController(appService);
      const result = await controller.bindUpload(
        'quiz-app/avatars/u1/some-id',
        {
          purpose: 'avatar',
        },
        user,
      );

      expect(result).toEqual({
        publicId: 'quiz-app/avatars/u1/some-id',
        bound: true,
        purpose: 'avatar',
        ownerId: 'u1',
      });
      expect(appService.bindAsset).toHaveBeenCalledWith({
        ownerId: 'u1',
        publicId: 'quiz-app/avatars/u1/some-id',
        purpose: 'avatar',
      });
    });

    it('propagates errors thrown by the service', async () => {
      const appService = makeUploadAppService();
      const err = new Error('bind failed');
      (appService.bindAsset as jest.Mock).mockRejectedValue(err);

      const controller = new UploadController(appService);
      await expect(
        controller.bindUpload('quiz-app/avatars/u1/x', { purpose: 'avatar' }, user),
      ).rejects.toBe(err);
    });
  });
});
