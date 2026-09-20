import { ForbiddenException, Injectable } from '@nestjs/common';
import { StorageApplicationService } from '@/core/storage/application/storage.application.service';
import type { JwtPayload } from '@/common/guards/jwt.guard';

@Injectable()
export class QuizAssetOwnershipGuard {
  constructor(private readonly storageOwnership: StorageApplicationService) {}

  async assertCallerOwnsQuizImage(
    imagePublicId: string | null | undefined,
    caller: JwtPayload,
  ): Promise<void> {
    if (imagePublicId === undefined || imagePublicId === null) {
      return;
    }

    const owns = await this.storageOwnership.userOwnsAssetForPurpose({
      publicId: imagePublicId,
      ownerId: caller.sub,
      purpose: 'quiz',
    });

    if (!owns) {
      throw new ForbiddenException({
        code: 'ASSET_NOT_OWNED',
        message:
          'The supplied cover image publicId is not owned by the authenticated user for the quiz cover purpose.',
      });
    }
  }
}
