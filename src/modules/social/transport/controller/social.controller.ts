import { Controller, Get, Post, Delete, Param, Query, ParseIntPipe, DefaultValuePipe, Body } from '@nestjs/common';
import { SocialApplicationService } from '@/modules/social/application/social-application.service';
import {
  FriendRequestDto,
  FriendDto,
  FollowerDto,
  FollowingDto,
  SocialCountsDto,
  RelationshipStatusDto,
  BlockedUserDto,
} from '@/modules/social/dto/response';
import { RequireAuth } from '@/common/guards/jwt.guard';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { User } from '@/common/decorators/user.decorator';

@Controller('social')
@RequireAuth()
export class SocialController {
  constructor(private readonly socialService: SocialApplicationService) {}

  // Friend Requests
  @Post('friend-request/:userId')
  async sendFriendRequest(
    @User() user: JwtPayload,
    @Param('userId') addresseeId: string,
  ): Promise<FriendRequestDto> {
    return this.socialService.sendFriendRequest(user, addresseeId);
  }

  @Get('friend-requests/incoming')
  async getPendingRequests(@User() user: JwtPayload): Promise<FriendRequestDto[]> {
    return this.socialService.getPendingRequests(user);
  }

  @Get('friend-requests/outgoing')
  async getSentRequests(@User() user: JwtPayload): Promise<FriendRequestDto[]> {
    return this.socialService.getSentRequests(user);
  }

  @Post('friend-requests/:friendshipId/respond')
  async respondToFriendRequest(
    @User() user: JwtPayload,
    @Param('friendshipId') friendshipId: string,
    @Body() body: { accept: boolean },
  ): Promise<{ message: string }> {
    await this.socialService.respondToFriendRequest(user, friendshipId, body.accept);
    return { message: body.accept ? 'Friend request accepted' : 'Friend request rejected' };
  }

  @Delete('friend-requests/:friendshipId')
  async cancelFriendRequest(
    @User() user: JwtPayload,
    @Param('friendshipId') friendshipId: string,
  ): Promise<{ message: string }> {
    await this.socialService.cancelFriendRequest(user, friendshipId);
    return { message: 'Friend request cancelled' };
  }

  // Friends
  @Get('friends')
  async getFriends(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FriendDto[]; hasNextPage: boolean }> {
    return this.socialService.getFriends(user, limit, cursor ?? null);
  }

  @Get('friends/:userId')
  async getFriendsOfUser(
    @User() user: JwtPayload,
    @Param('userId') targetUserId: string,
  ): Promise<{ items: FriendDto[]; hasNextPage: boolean }> {
    const result = await this.socialService.getFriends({ ...user, sub: targetUserId }, 20, null);
    return result;
  }

  @Delete('friends/:userId')
  async removeFriend(
    @User() user: JwtPayload,
    @Param('userId') friendId: string,
  ): Promise<{ message: string }> {
    await this.socialService.removeFriend(user, friendId);
    return { message: 'Friend removed' };
  }

  // Blocking
  @Post('block/:userId')
  async blockUser(
    @User() user: JwtPayload,
    @Param('userId') blockedId: string,
    @Body() body: { reason?: string },
  ): Promise<{ message: string }> {
    await this.socialService.blockUser(user, blockedId, body.reason);
    return { message: 'User blocked' };
  }

  @Delete('block/:userId')
  async unblockUser(
    @User() user: JwtPayload,
    @Param('userId') blockedId: string,
  ): Promise<{ message: string }> {
    await this.socialService.unblockUser(user, blockedId);
    return { message: 'User unblocked' };
  }

  @Get('blocked')
  async getBlockedUsers(@User() user: JwtPayload): Promise<BlockedUserDto[]> {
    return this.socialService.getBlockedUsers(user);
  }

  // Following
  @Post('follow/:userId')
  async followUser(
    @User() user: JwtPayload,
    @Param('userId') followingId: string,
  ): Promise<{ message: string }> {
    await this.socialService.followUser(user, followingId);
    return { message: 'Now following user' };
  }

  @Delete('follow/:userId')
  async unfollowUser(
    @User() user: JwtPayload,
    @Param('userId') followingId: string,
  ): Promise<{ message: string }> {
    await this.socialService.unfollowUser(user, followingId);
    return { message: 'Unfollowed user' };
  }

  @Get('followers')
  async getFollowers(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FollowerDto[]; hasNextPage: boolean }> {
    return this.socialService.getFollowers(user, limit, cursor ?? null);
  }

  @Get('following')
  async getFollowing(
    @User() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('cursor') cursor?: string,
  ): Promise<{ items: FollowingDto[]; hasNextPage: boolean }> {
    return this.socialService.getFollowing(user, limit, cursor ?? null);
  }

  // Relationship
  @Get('relationship/:userId')
  async getRelationshipStatus(
    @User() user: JwtPayload,
    @Param('userId') targetId: string,
  ): Promise<RelationshipStatusDto> {
    return this.socialService.getRelationshipStatus(user, targetId);
  }

  @Get('counts')
  async getSocialCounts(@User() user: JwtPayload): Promise<SocialCountsDto> {
    return this.socialService.getSocialCounts(user);
  }
}
