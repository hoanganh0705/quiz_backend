import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { and, isNull, or, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DRIZZLE, type DrizzleDB } from '../../core/database/database.module';
import { userSessions, users } from '../../core/database/schema';
import { RegisterDto } from './dto/request/register.dto';
import { createHash } from 'crypto';

export type RegisterResult = {
  userId: string;
  username: string;
  email: string;
  createdAt: string;
  accessToken: string;
  refreshToken: string;
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  static readonly ACCESS_TOKEN_EXPIRES_IN = '15m';
  static readonly REFRESH_TOKEN_EXPIRES_IN = '7d';
  static readonly REFRESH_TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

  private getAccessTokenSecret(): string {
    return process.env.JWT_ACCESS_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'access-dev-secret';
  }

  private getRefreshTokenSecret(): string {
    return process.env.JWT_REFRESH_TOKEN_SECRET ?? process.env.JWT_SECRET ?? 'refresh-dev-secret';
  }

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = registerDto.email.trim().toLowerCase();
    const normalizedUsername = registerDto.username.trim().toLowerCase();

    const [existingUser] = await this.db
      .select({
        userId: users.userId,
      })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(
            sql`lower(${users.email}) = ${normalizedEmail}`,
            sql`lower(${users.username}) = lower(${normalizedUsername})`,
          ),
        ),
      )
      .limit(1);

    if (existingUser) {
      throw new ConflictException('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(registerDto.password, 12);

    const [createdUser] = await this.db
      .insert(users)
      .values({
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
      })
      .returning({
        userId: users.userId,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
      })
      .catch(() => {
        throw new InternalServerErrorException('Failed to create user');
      });

    const accessToken = await this.jwtService.signAsync(
      {
        sub: createdUser.userId,
        username: createdUser.username,
        email: createdUser.email,
      },
      {
        secret: this.getAccessTokenSecret(),
        expiresIn: AuthService.ACCESS_TOKEN_EXPIRES_IN,
      },
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: createdUser.userId,
        type: 'refresh',
      },
      {
        secret: this.getRefreshTokenSecret(),
        expiresIn: AuthService.REFRESH_TOKEN_EXPIRES_IN,
      },
    );

    const refreshTokenHash = createHash('sha256').update(refreshToken).digest('hex');
    const expiresAt = new Date(
      Date.now() + AuthService.REFRESH_TOKEN_COOKIE_MAX_AGE_MS,
    ).toISOString();

    await this.db.insert(userSessions).values({
      userId: createdUser.userId,
      refreshTokenHash,
      expiresAt,
    });

    return {
      ...createdUser,
      accessToken,
      refreshToken,
    };
  }
}
