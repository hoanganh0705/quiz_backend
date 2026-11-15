import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { and, desc, asc, eq, ilike, or, sql, isNull } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';

import { DRIZZLE } from '@/core/database/drizzle.constants';
import type { DrizzleDB } from '@/core/database/database.module';
import { users, userProfiles, userProfileSettings } from '@/core/database/schema';

import type { AdminUserSearchQueryDto } from '../dto/admin-user-search-query.dto';
import type { AdminUserRowDto } from '../dto/admin-user-row.dto';
import type { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import type { AdminUserRoleResponseDto, AdminUserRoleItemDto } from '../dto/admin-user-role-grant.dto';

@Injectable()
export class AdminUserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async searchUsers(query: AdminUserSearchQueryDto): Promise<{
    items: AdminUserRowDto[];
    page: number;
    limit: number;
    total: number;
  }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = Math.max(query.page ?? 1, 1);
    const offset = (page - 1) * limit;

    const conditions = [isNull(users.deletedAt)];

    if (query.search && query.search.trim().length > 0) {
      const pattern = `%${query.search.trim()}%`;
      conditions.push(
        or(
          ilike(users.username, pattern),
          ilike(users.email, pattern),
          ilike(userProfiles.displayName, pattern),
        )!,
      );
    }

    if (query.role) {
      conditions.push(eq(users.role, query.role));
    }

    if (query.isVerified !== undefined) {
      conditions.push(eq(users.isVerified, query.isVerified));
    }

    const whereClause = and(...conditions);

    const sortColumn =
      query.sortBy === 'username'
        ? users.username
        : query.sortBy === 'role'
          ? users.role
          : users.createdAt;

    const orderDirection = query.sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select({
          userId: users.userId,
          username: users.username,
          email: users.email,
          displayName: userProfiles.displayName,
          avatarUrl: userProfiles.avatarUrl,
          role: users.role,
          isVerified: users.isVerified,
          currentStreak: users.currentStreak,
          longestStreak: users.longestStreak,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          deletedAt: users.deletedAt,
        })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
        .where(whereClause)
        .orderBy(orderDirection)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(users)
        .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
        .where(whereClause),
    ]);

    const items: AdminUserRowDto[] = rows.map((r) => ({
      userId: r.userId,
      username: r.username,
      email: r.email,
      displayName: r.displayName ?? null,
      avatarUrl: r.avatarUrl ?? null,
      role: r.role as 'user' | 'moderator' | 'admin',
      isVerified: Boolean(r.isVerified),
      currentStreak: Number(r.currentStreak ?? 0),
      longestStreak: Number(r.longestStreak ?? 0),
      xpTotal: 0,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      deletedAt: r.deletedAt ?? null,
    }));

    return { items, page, limit, total: Number(total) };
  }

  async getUserById(userId: string): Promise<AdminUserRowDto> {
    const [row] = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        displayName: userProfiles.displayName,
        avatarUrl: userProfiles.avatarUrl,
        role: users.role,
        isVerified: users.isVerified,
        currentStreak: users.currentStreak,
        longestStreak: users.longestStreak,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .leftJoin(userProfiles, eq(userProfiles.userId, users.userId))
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return {
      userId: row.userId,
      username: row.username,
      email: row.email,
      displayName: row.displayName ?? null,
      avatarUrl: row.avatarUrl ?? null,
      role: row.role as 'user' | 'moderator' | 'admin',
      isVerified: Boolean(row.isVerified),
      currentStreak: Number(row.currentStreak ?? 0),
      longestStreak: Number(row.longestStreak ?? 0),
      xpTotal: 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt ?? null,
    };
  }

  async createUser(input: AdminCreateUserDto): Promise<AdminUserRowDto> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedUsername = input.username.trim().toLowerCase();

    const existing = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(eq(users.email, normalizedEmail), eq(users.username, normalizedUsername)),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('A user with that username or email address already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const nowIso = new Date().toISOString();
    const role = input.role ?? 'user';
    const isVerified = input.isVerified ?? true;

    const result = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          username: normalizedUsername,
          email: normalizedEmail,
          passwordHash,
          role,
          isVerified,
          createdAt: nowIso,
          updatedAt: nowIso,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to insert user row');
      }

      await tx.insert(userProfiles).values({
        userId: created.userId,
        displayName: input.displayName?.trim() || null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      await tx.insert(userProfileSettings).values({
        userId: created.userId,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      return created;
    });

    return {
      userId: result.userId,
      username: result.username,
      email: result.email,
      displayName: input.displayName?.trim() || null,
      avatarUrl: null,
      role: result.role as 'user' | 'moderator' | 'admin',
      isVerified: Boolean(result.isVerified),
      currentStreak: 0,
      longestStreak: 0,
      xpTotal: 0,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      deletedAt: null,
    };
  }

  async updateUserRole(
    actorId: string,
    targetUserId: string,
    newRole: 'user' | 'moderator' | 'admin',
  ): Promise<AdminUserRowDto> {
    if (actorId === targetUserId && newRole !== 'admin') {
      throw new ForbiddenException('Cannot revoke admin role from your own account');
    }

    const user = await this.getUserById(targetUserId);
    const nowIso = new Date().toISOString();

    await this.db
      .update(users)
      .set({
        role: newRole,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, targetUserId), isNull(users.deletedAt)));

    return {
      ...user,
      role: newRole,
      updatedAt: nowIso,
    };
  }

  async deleteUser(
    actorId: string,
    targetUserId: string,
  ): Promise<{ success: boolean; userId: string }> {
    if (actorId === targetUserId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    await this.getUserById(targetUserId);
    const nowIso = new Date().toISOString();

    await this.db
      .update(users)
      .set({
        deletedAt: nowIso,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, targetUserId), isNull(users.deletedAt)));

    return { success: true, userId: targetUserId };
  }

  async getUserRoles(targetUserId: string): Promise<AdminUserRoleItemDto[]> {
    const user = await this.getUserById(targetUserId);

    if (user.role === 'user') {
      return [];
    }

    return [
      {
        role: user.role,
        grantedAt: user.updatedAt,
      },
    ];
  }

  async grantUserRole(
    actorId: string,
    targetUserId: string,
    roleInput: string,
  ): Promise<AdminUserRoleResponseDto> {
    void actorId;
    const lower = roleInput.toLowerCase();
    const targetRole: 'user' | 'moderator' | 'admin' =
      lower.includes('admin') || lower === 'admin'
        ? 'admin'
        : lower.includes('mod') || lower === 'moderator'
          ? 'moderator'
          : 'moderator';

    const nowIso = new Date().toISOString();

    await this.db
      .update(users)
      .set({
        role: targetRole,
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, targetUserId), isNull(users.deletedAt)));

    return {
      userId: targetUserId,
      role: roleInput,
      grantedAt: nowIso,
    };
  }

  async revokeUserRole(
    actorId: string,
    targetUserId: string,
    roleInput: string,
  ): Promise<AdminUserRoleResponseDto> {
    if (actorId === targetUserId) {
      throw new ForbiddenException('Cannot revoke a role from your own account');
    }

    await this.getUserById(targetUserId);
    const nowIso = new Date().toISOString();

    await this.db
      .update(users)
      .set({
        role: 'user',
        updatedAt: nowIso,
      })
      .where(and(eq(users.userId, targetUserId), isNull(users.deletedAt)));

    return {
      userId: targetUserId,
      role: roleInput,
      grantedAt: nowIso,
    };
  }
}
