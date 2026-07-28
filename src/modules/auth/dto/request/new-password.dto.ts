export const NEW_PASSWORD_MIN = 8;
export const NEW_PASSWORD_MAX = 128;
export const NEW_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
export const NEW_PASSWORD_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter, and one number';
export const NEW_PASSWORD_MIN_MESSAGE = `Password must be at least ${NEW_PASSWORD_MIN} characters long`;
export const NEW_PASSWORD_MAX_MESSAGE = `Password must not exceed ${NEW_PASSWORD_MAX} characters`;

/**
 * Shared "new password" validation rules used by:
 * - RegisterDto.password
 * - ResetPasswordDto.newPassword
 * - ChangePasswordDto.newPassword
 *
 * Each DTO declares its own password field (the property name and Swagger
 * description differ per endpoint). The validation rules and limits are
 * imported from this module so the three sites cannot drift apart again.
 */
