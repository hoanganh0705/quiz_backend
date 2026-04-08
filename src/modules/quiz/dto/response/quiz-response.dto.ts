import { QuizVersionResponseDto } from './quiz-version-response.dto';

export class QuizResponseDto {
  quizId!: string;
  creatorId!: string | null;
  title!: string;
  description!: string | null;
  slug!: string;
  requirements!: string | null;
  imageUrl!: string | null;
  isFeatured!: boolean;
  isHidden!: boolean;
  isVerified!: boolean;
  publishedVersionId!: string | null;
  createdAt!: string;
  updatedAt!: string;
  publishedVersion!: QuizVersionResponseDto | null;
}
