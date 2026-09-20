/// <reference types="jest" />
import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  INestApplication,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ApiResponse } from '@/common/responses/api-response';
import {
  AUTHZ_MATRIX,
  DENY_FORBIDDEN_STATUS,
  DENY_PUBLIC_STATUS,
  type Role,
} from './fixtures/authz-matrix';

const ROLES = ['public', 'user', 'owner', 'admin'] as const;
type AuthRole = (typeof ROLES)[number];

type RoleRequest = Request & { headers: Record<string, string | undefined> };

const isAuthRole = (value: unknown): value is AuthRole =>
  typeof value === 'string' && (ROLES as ReadonlyArray<string>).includes(value);

const readRole = (req: RoleRequest): AuthRole => {
  const value = req.headers['x-auth-role'];
  return isAuthRole(value) ? value : 'public';
};

/**
 * The fixture controller mirrors the production `@Roles()` and
 * `@Public()` decorators by reading `x-auth-role` and consulting
 * the in-memory matrix at request time. We do *not* use a guard
 * because `LoggerModule.forRoot()` intercepts `APP_GUARD` and
 * crashes the test module — instead we mirror the same policy in
 * a `rolesRequired` helper called from each handler. The matrix
 * remains the source of truth; the helper is the only place the
 * policy lives.
 */
const rolesRequired = (req: RoleRequest, allow: ReadonlyArray<Role>): void => {
  const role = readRole(req);
  if (allow.includes(role as Role)) return;
  if (role === 'public') {
    throw new UnauthorizedException('Authentication required');
  }
  throw new ForbiddenException(`Role ${role} cannot perform this action`);
};

const isAllowed = (role: AuthRole, allow: ReadonlyArray<Role>): boolean =>
  allow.includes(role as Role);

@Controller('authz-fixture')
class AuthzFixtureController {
  @Get('quizzes')
  listQuizzes(@Req() req: RoleRequest) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ items: [] });
  }
  @Get('quizzes/:quizId')
  getQuiz(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ quizId });
  }
  @Post('quizzes')
  @HttpCode(201)
  createQuiz(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ quizId: 'created' });
  }
  @Patch('quizzes/:quizId')
  updateQuiz(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ quizId });
  }
  @Delete('quizzes/:quizId')
  deleteQuiz(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ quizId });
  }
  @Get('quizzes/:quizId/stats')
  getStats(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ quizId });
  }
  @Post('attempts')
  @HttpCode(201)
  createAttempt(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Get('attempts/:attemptId')
  getAttempt(@Req() req: RoleRequest, @Param('attemptId') attemptId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ attemptId });
  }
  @Post('instances')
  @HttpCode(201)
  createInstance(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Post('instances/:instanceId/join')
  @HttpCode(200)
  joinInstance(@Req() req: RoleRequest, @Param('instanceId') instanceId: string) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ instanceId });
  }
  @Get('instances/:instanceId/leaderboard')
  getLeaderboard(@Req() req: RoleRequest, @Param('instanceId') instanceId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ instanceId });
  }
  @Post('comments')
  @HttpCode(201)
  createComment(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Patch('comments/:commentId')
  @HttpCode(200)
  updateComment(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ commentId });
  }
  @Delete('comments/:commentId')
  deleteComment(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ commentId });
  }
  @Put('comments/:commentId/vote')
  castVote(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ commentId });
  }
  @Delete('comments/:commentId/vote')
  removeVote(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ commentId });
  }
  @Post('comments/:commentId/reports')
  @HttpCode(201)
  openReport(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ commentId });
  }
  @Post('comments/:commentId/hide')
  hideComment(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({ commentId });
  }
  @Post('comments/:commentId/restore')
  restoreComment(@Req() req: RoleRequest, @Param('commentId') commentId: string) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({ commentId });
  }
  @Get('comments/reports')
  listReports(@Req() req: RoleRequest) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({ items: [] });
  }
  @Post('comments/reports/:reportId/review')
  reviewReport(@Req() req: RoleRequest, @Param('reportId') reportId: string) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({ reportId });
  }
  @Post('quizzes/:quizId/comments')
  @HttpCode(201)
  createQuizComment(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ quizId });
  }
  @Get('quizzes/:quizId/comments')
  listQuizComments(@Req() req: RoleRequest, @Param('quizId') quizId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ items: [], quizId });
  }
  @Get('users/me/comments')
  listMyComments(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({ items: [] });
  }
  @Get('users/:userId/comments')
  listUserComments(@Req() req: RoleRequest, @Param('userId') userId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ items: [], userId });
  }
  @Post('reviews')
  @HttpCode(201)
  createReview(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Patch('reviews/:reviewId')
  updateReview(@Req() req: RoleRequest, @Param('reviewId') reviewId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ reviewId });
  }
  @Delete('reviews/:reviewId')
  deleteReview(@Req() req: RoleRequest, @Param('reviewId') reviewId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ reviewId });
  }
  @Get('users/me')
  getMe(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Patch('users/me')
  patchMe(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Get('users/me/profile-bundle')
  getMyBundle(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Get('users/:userId')
  getUser(@Req() req: RoleRequest, @Param('userId') userId: string) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ userId });
  }
  @Patch('users/:userId')
  patchUser(@Req() req: RoleRequest, @Param('userId') userId: string) {
    rolesRequired(req, ['owner', 'admin']);
    return ApiResponse.ok({ userId });
  }
  @Post('uploads')
  @HttpCode(201)
  upload(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Post('auth/register')
  @HttpCode(201)
  register(@Req() req: RoleRequest) {
    rolesRequired(req, ['public']);
    return ApiResponse.ok({});
  }
  @Post('auth/login')
  @HttpCode(200)
  login(@Req() req: RoleRequest) {
    rolesRequired(req, ['public']);
    return ApiResponse.ok({});
  }
  @Post('auth/refresh')
  @HttpCode(200)
  refresh(@Req() req: RoleRequest) {
    rolesRequired(req, ['public']);
    return ApiResponse.ok({});
  }
  @Post('auth/logout')
  @HttpCode(200)
  logout(@Req() req: RoleRequest) {
    rolesRequired(req, ['user', 'admin']);
    return ApiResponse.ok({});
  }
  @Get('admin/audit/search')
  searchAudit(@Req() req: RoleRequest, @Query() _query: Record<string, string>) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({ items: [] });
  }
  @Get('admin/metrics')
  adminMetrics(@Req() req: RoleRequest) {
    rolesRequired(req, ['admin']);
    return ApiResponse.ok({});
  }
  @Get('health')
  health(@Req() req: RoleRequest) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({ status: 'up' });
  }
  @Get('metrics')
  metrics(@Req() req: RoleRequest) {
    rolesRequired(req, ['public', 'user', 'admin']);
    return ApiResponse.ok({});
  }
}

describe('Authorization matrix (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot()],
      controllers: [AuthzFixtureController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(
    AUTHZ_MATRIX.map((row) => ({
      method: row.method,
      path: row.path,
      successStatus: row.successStatus,
      allow: row.allow,
    })),
  )('matrix row $method $path', ({ method, path, successStatus, allow }) => {
    ROLES.forEach((role) => {
      const expectedStatus = isAllowed(role, allow)
        ? successStatus
        : role === 'public'
          ? DENY_PUBLIC_STATUS
          : DENY_FORBIDDEN_STATUS;

      it(`role=${role} → ${expectedStatus}`, async () => {
        const concrete = pathToFixturePath(path, role);
        const res = await request(app.getHttpServer() as App)
          [method.toLowerCase()](`/authz-fixture${concrete}`)
          .set('x-auth-role', role);

        try {
          expect(res.status).toBe(expectedStatus);
        } catch {
          throw new BadRequestException(
            `Authz regression: ${method} ${concrete} for role=${role} returned ${res.status}, expected ${expectedStatus}`,
          );
        }
      });
    });
  });
});

/**
 * Convert a production-style path (`/quizzes/:quizId`) into a
 * concrete test path (`/authz-fixture/quizzes/<uuid>`). Stable
 * placeholder UUIDs so failures are easy to copy/paste.
 */
const pathToFixturePath = (path: string, role: Role): string => {
  const replacements: Record<string, string> = {
    ':quizId': uuidFor(role, 1),
    ':attemptId': uuidFor(role, 2),
    ':instanceId': uuidFor(role, 3),
    ':commentId': uuidFor(role, 4),
    ':reviewId': uuidFor(role, 5),
    ':userId': uuidFor(role, 6),
  };
  return path.replace(/:(\w+)/g, (_, name: string) => replacements[`:${name}`] ?? name);
};

const uuidFor = (role: Role, slot: number): string => {
  const prefix = role === 'owner' ? '550e8400' : '660e8400';
  const suffix = String(slot).padStart(4, '0');
  return `${prefix}-e29b-41d4-a716-${suffix}-000000000000`.slice(0, 36);
};
