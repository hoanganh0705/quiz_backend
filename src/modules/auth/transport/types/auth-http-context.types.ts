import type { SessionRequestContext } from '../../types/auth-context.types';

export type AuthCookieInstructions = {
  refreshToken?: string;
  clearRefreshToken?: boolean;
};

export type AuthRequestContext = {
  session: SessionRequestContext;
  setRefreshToken: (token: string) => void;
  clearRefreshToken: () => void;
  getCookieInstructions: () => Readonly<AuthCookieInstructions>;
};
