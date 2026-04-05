export class UserMeResponseDto {
  userId!: string;
  username!: string;
  email!: string;
  displayName!: string | null;
  avatarUrl!: string | null;
  bio!: string | null;
  xpTotal!: number;
  currentStreak!: number;
  longestStreak!: number;
  settings!: Record<string, unknown>;
  createdAt!: string;
  updatedAt!: string;
}
