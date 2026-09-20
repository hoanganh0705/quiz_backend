import { users } from '@/core/database/schema';

/** Columns shared across all identity queries against the `users` table. */
export const USER_IDENTITY_COLUMNS = {
  userId: users.userId,
  username: users.username,
  email: users.email,
  role: users.role,
};

export type UserIdentityRow = {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
};

export type UserWithPasswordRow = UserIdentityRow & {
  passwordHash: string;
  isVerified: boolean;
};

export type CreatedUserRow = UserIdentityRow & {
  createdAt: string;
  isVerified: boolean;
};

export type UserVerificationRow = {
  userId: string;
  email: string;
};

export type UserVerificationStatusRow = {
  userId: string;
  email: string;
  isVerified: boolean;
};
