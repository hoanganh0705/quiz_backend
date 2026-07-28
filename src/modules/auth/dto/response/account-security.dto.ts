import { ApiProperty } from '@nestjs/swagger';

/**
 * Response payload for `GET /auth/security/dashboard`.
 *
 * A snapshot of the authenticated user's security posture. The fields are
 * composed from two distinct domain concerns (see
 * `account-security.service.ts` for the data lineage):
 *
 * - **User-domain fields** — `emailVerified`, `lastPasswordChangeAt`,
 *   `lastSuccessfulLoginAt`.
 * - **Session-domain field** — `activeSessionCount`.
 * - **Derived field** — `passwordAgeDays` is computed at the application
 *   service layer from `lastPasswordChangeAt`; it is never persisted.
 *
 * @see docs/audits/AUTH_MODULE_PRODUCTION_READINESS_AUDIT.md §Phase 6 #6
 *      for the `passwordAgeDays` addition and §Phase 8 #27 for the snapshot
 *      semantic on `activeSessionCount`.
 */
export class AccountSecurityDto {
  @ApiProperty({ description: 'Whether the account email is verified' })
  emailVerified!: boolean;

  @ApiProperty({
    description:
      'Snapshot of the number of currently active sessions. May differ from `GET /auth/sessions` length under concurrent revocations.',
    example: 1,
  })
  activeSessionCount!: number;

  @ApiProperty({
    description: 'Timestamp of the last successful login (PostgreSQL timestamptz)',
    type: String,
    nullable: true,
    example: '2026-07-14 01:53:39.812376+00',
  })
  lastSuccessfulLoginAt!: string | null;

  @ApiProperty({
    description:
      'Timestamp of the last password change (PostgreSQL timestamptz, null if never changed)',
    type: String,
    nullable: true,
    example: '2026-07-14 01:49:39.302+00',
  })
  lastPasswordChangeAt!: string | null;

  @ApiProperty({
    description:
      'Days since the last password change (null if the password has never been changed). ' +
      'Derived server-side from lastPasswordChangeAt — never stored.',
    type: Number,
    nullable: true,
    example: 14,
  })
  passwordAgeDays!: number | null;
}
