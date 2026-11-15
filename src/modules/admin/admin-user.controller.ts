import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { Permissions } from '@/common/authorization/decorators/permissions.decorator';
import { Permission } from '@/common/authorization/permissions';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { ApiResponse } from '@/common/responses/api-response';
import { ApiOkResource, ApiOkResourceList, ApiCreatedResource } from '@/common/swagger/api-ok';

import { AdminUserService } from './application/admin-user.service';
import { AdminUserSearchQueryDto } from './dto/admin-user-search-query.dto';
import { AdminUserRowDto } from './dto/admin-user-row.dto';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserRoleDto } from './dto/admin-update-user-role.dto';
import {
  AdminUserRoleGrantDto,
  AdminUserRoleResponseDto,
  AdminUserRoleItemDto,
} from './dto/admin-user-role-grant.dto';

@ApiTags('admin-users')
@ApiBearerAuth()
@Controller('admin/users')
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Paginated user search and listing for admins' })
  @ApiOkResourceList(AdminUserRowDto, 'offset', {
    description: 'Paginated user rows matching query criteria.',
  })
  async listUsers(@Query() query: AdminUserSearchQueryDto) {
    const { items, page, limit, total } = await this.adminUserService.searchUsers(query);
    return ApiResponse.page(items, {
      kind: 'offset',
      page,
      limit,
      total,
      hasMore: page * limit < total,
    });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Create a new user account as administrator' })
  @ApiCreatedResource(AdminUserRowDto, { description: 'The newly created user record.' })
  async createUser(@Body() body: AdminCreateUserDto) {
    const created = await this.adminUserService.createUser(body);
    return ApiResponse.created(created);
  }

  @Get(':userId')
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Get single user detail by UUID' })
  @ApiOkResource(AdminUserRowDto, { description: 'User account details.' })
  async getUser(@Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string) {
    const user = await this.adminUserService.getUserById(userId);
    return ApiResponse.ok(user);
  }

  @Patch(':userId/role')
  @Permissions(Permission.USER_GRANT_ROLE)
  @ApiOperation({ summary: 'Update system role of a user' })
  @ApiOkResource(AdminUserRowDto, { description: 'User record with updated role.' })
  async updateUserRole(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Body() body: AdminUpdateUserRoleDto,
  ) {
    const updated = await this.adminUserService.updateUserRole(admin.sub, userId, body.role);
    return ApiResponse.ok(updated);
  }

  @Delete(':userId')
  @Permissions(Permission.USER_MANAGE)
  @ApiOperation({ summary: 'Soft-delete a user account' })
  async deleteUser(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
  ) {
    const result = await this.adminUserService.deleteUser(admin.sub, userId);
    return ApiResponse.ok(result);
  }

  @Get(':userId/roles')
  @Permissions(Permission.USER_GRANT_ROLE)
  @ApiOperation({ summary: 'List roles/permissions assigned to a user' })
  @ApiOkResource(AdminUserRoleItemDto, { description: 'Array of roles assigned to the user.' })
  async getUserRoles(@Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string) {
    const roles = await this.adminUserService.getUserRoles(userId);
    return ApiResponse.ok(roles);
  }

  @Post(':userId/roles')
  @HttpCode(HttpStatus.OK)
  @Permissions(Permission.USER_GRANT_ROLE)
  @ApiOperation({ summary: 'Grant a role or permission to a user' })
  @ApiOkResource(AdminUserRoleResponseDto, { description: 'Granted role response.' })
  async grantUserRole(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Body() body: AdminUserRoleGrantDto,
  ) {
    const result = await this.adminUserService.grantUserRole(admin.sub, userId, body.role);
    return ApiResponse.ok(result);
  }

  @Delete(':userId/roles/:role')
  @Permissions(Permission.USER_REVOKE_ROLE)
  @ApiOperation({ summary: 'Revoke a role or permission from a user' })
  @ApiOkResource(AdminUserRoleResponseDto, { description: 'Revoked role response.' })
  async revokeUserRole(
    @CurrentUser() admin: JwtPayload,
    @Param('userId', new ParseUUIDPipe({ version: '7' })) userId: string,
    @Param('role') role: string,
  ) {
    const result = await this.adminUserService.revokeUserRole(admin.sub, userId, role);
    return ApiResponse.ok(result);
  }
}
