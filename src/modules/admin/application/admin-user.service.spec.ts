import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import type { DrizzleDB } from '@/core/database/database.module';

describe('AdminUserService', () => {
  it('clamps limit to 100 on searchUsers', async () => {
    let call = 0;
    const fake = {
      select: () => {
        call += 1;
        const isTotal = call > 1;
        const builder = {
          from: () => builder,
          leftJoin: () => builder,
          where: () => builder,
          orderBy: () => builder,
          limit: () => builder,
          offset: () => builder,
          then: (onfulfilled?: (value: unknown) => unknown) =>
            Promise.resolve(isTotal ? [{ total: 0 }] : []).then(onfulfilled),
        };
        return builder;
      },
    } as unknown as DrizzleDB;

    const service = new AdminUserService(fake);
    const result = await service.searchUsers({ limit: 500 });
    expect(result.limit).toBe(100);
    expect(result.page).toBe(1);
  });

  it('throws ForbiddenException when admin attempts to revoke own admin role', async () => {
    const fake = {} as DrizzleDB;
    const service = new AdminUserService(fake);

    await expect(
      service.updateUserRole('admin-uuid-1', 'admin-uuid-1', 'user'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when admin attempts to delete own account', async () => {
    const fake = {} as DrizzleDB;
    const service = new AdminUserService(fake);

    await expect(
      service.deleteUser('admin-uuid-1', 'admin-uuid-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when user does not exist', async () => {
    const fake = {
      select: () => {
        const builder = {
          from: () => builder,
          leftJoin: () => builder,
          where: () => builder,
          limit: () => builder,
          then: (onfulfilled?: (value: unknown) => unknown) =>
            Promise.resolve([]).then(onfulfilled),
        };
        return builder;
      },
    } as unknown as DrizzleDB;

    const service = new AdminUserService(fake);
    await expect(service.getUserById('missing-uuid')).rejects.toThrow(NotFoundException);
  });
});
