export type RegisterResult = {
  message: string;
};

export type VerifyEmailResult = {
  message: string;
};

export type LoginResult = {
  userId: string;
  username: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export type RefreshTokenResult = {
  accessToken: string;
  refreshToken: string;
};

export type ForgotPasswordResult = {
  message: string;
};

export type ResetPasswordResult = {
  message: string;
};

export type ChangePasswordResult = {
  message: string;
};

export type SessionManagementResult = {
  message: string;
};

export type AccountSecurityResult = {
  emailVerified: boolean;
  activeSessionCount: number;
  lastSuccessfulLoginAt: string | null;
  lastPasswordChangeAt: string | null;
};

export type AvailabilityResult = {
  available: boolean;
};

export type CredentialVerificationResult = {
  valid: boolean;
};

export type AccountDeletionResult = {
  message: string;
};

export type CurrentUserResult = {
  userId: string;
  username: string;
  email: string;
  role: 'admin' | 'moderator' | 'user';
  isVerified: boolean;
};

// =========================================================================
// Application-layer result types
// =========================================================================
// These types live alongside the domain result types because they
// carry adapter-layer concerns (DTOs, raw refresh-token strings) that
// the domain services deliberately do not see. They are kept in
// `auth-result.types.ts` rather than the application service file so
// the application file does not need to be the import source for every
// consumer of its return shape.

import type { LoginResponseDto } from '../dto/response/login-response.dto';
import type { RefreshTokenResponseDto } from '../dto/response/refresh-token-response.dto';
import type { SessionListResponseDto } from '../dto/response/session-management.dto';
import type { SessionManagementService } from '../domain/session-management.service';

export type LoginApplicationResult = {
  response: LoginResponseDto;
  refreshToken: string;
  sessionId: string;
};

export type RefreshTokenApplicationResult = {
  response: RefreshTokenResponseDto;
  refreshToken: string;
};

export type SessionResponse = SessionListResponseDto['sessions'][number];

export type ActiveSessionResult = Awaited<
  ReturnType<SessionManagementService['getActiveSessions']>
>[number];
