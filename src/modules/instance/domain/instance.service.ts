import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { JwtPayload } from '@/common/guards/jwt.guard';
import { QUIZ_INSTANCE_REPOSITORY_PORT } from './ports';
import type { QuizInstanceRepositoryPort } from './ports';
import {
  INSTANCE_NOT_FOUND_MESSAGE,
  INSTANCE_NOT_HOST_MESSAGE,
  INSTANCE_NOT_OPEN_MESSAGE,
  INSTANCE_FULL_MESSAGE,
  INSTANCE_ALREADY_STARTED_MESSAGE,
  INSTANCE_ALREADY_CLOSED_MESSAGE,
  PLAYER_ALREADY_JOINED_MESSAGE,
  PLAYER_NOT_IN_INSTANCE_MESSAGE,
} from '../instance.constants';
import {
  InstanceNotFoundError,
  InstanceNotHostError,
  InstanceNotOpenError,
  InstanceFullError,
  InstanceAlreadyStartedError,
  InstanceAlreadyClosedError,
  PlayerAlreadyJoinedError,
  PlayerNotInInstanceError,
} from './errors';

@Injectable()
export class InstanceService {
  constructor(
    @Inject(QUIZ_INSTANCE_REPOSITORY_PORT)
    private readonly instanceRepository: QuizInstanceRepositoryPort,
    @InjectPinoLogger(InstanceService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createInstance(params: {
    quizVersionId: string;
    user: JwtPayload;
    maxPlayers: number | null;
  }): Promise<{ instanceId: string; hostUserId: string }> {
    const nowIso = new Date().toISOString();

    const result = await this.instanceRepository.createInstance({
      quizVersionId: params.quizVersionId,
      hostUserId: params.user.sub,
      maxPlayers: params.maxPlayers,
      nowIso,
    });

    // Auto-add host as a player
    await this.instanceRepository.addPlayer({
      instanceId: result.instanceId,
      userId: params.user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'instance_created',
      instanceId: result.instanceId,
      hostUserId: params.user.sub,
      quizVersionId: params.quizVersionId,
    });

    return { instanceId: result.instanceId, hostUserId: params.user.sub };
  }

  async getInstanceById(instanceId: string): Promise<import('./ports').QuizInstanceDetailRow> {
    const instance = await this.instanceRepository.getInstanceDetailById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return instance;
  }

  async joinInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.status !== 'open') {
      throw new InstanceNotOpenError(INSTANCE_NOT_OPEN_MESSAGE);
    }

    const existingPlayer = await this.instanceRepository.getPlayer(instanceId, user.sub);

    if (existingPlayer) {
      throw new PlayerAlreadyJoinedError(PLAYER_ALREADY_JOINED_MESSAGE);
    }

    if (instance.maxPlayers !== null) {
      const currentCount = await this.instanceRepository.countPlayers(instanceId);
      if (currentCount >= instance.maxPlayers) {
        throw new InstanceFullError(INSTANCE_FULL_MESSAGE);
      }
    }

    await this.instanceRepository.addPlayer({
      instanceId,
      userId: user.sub,
      nowIso,
    });

    this.logger.info({
      event: 'player_joined',
      instanceId,
      userId: user.sub,
    });

    return { message: 'Joined the instance successfully' };
  }

  async startInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status !== 'open') {
      throw new InstanceAlreadyStartedError(INSTANCE_ALREADY_STARTED_MESSAGE);
    }

    await this.instanceRepository.updateInstanceStatus({
      instanceId,
      status: 'running',
      startedAt: nowIso,
      nowIso,
    });

    this.logger.info({
      event: 'instance_started',
      instanceId,
      userId: user.sub,
    });

    return { message: 'Instance started' };
  }

  async closeInstance(instanceId: string, user: JwtPayload): Promise<{ message: string }> {
    const nowIso = new Date().toISOString();

    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    if (instance.hostUserId !== user.sub) {
      throw new InstanceNotHostError(INSTANCE_NOT_HOST_MESSAGE);
    }

    if (instance.status === 'closed' || instance.status === 'finished') {
      throw new InstanceAlreadyClosedError(INSTANCE_ALREADY_CLOSED_MESSAGE);
    }

    await this.instanceRepository.updateInstanceStatus({
      instanceId,
      status: 'closed',
      closedAt: nowIso,
      nowIso,
    });

    this.logger.info({
      event: 'instance_closed',
      instanceId,
      userId: user.sub,
    });

    return { message: 'Instance closed' };
  }

  async getLeaderboard(instanceId: string): Promise<import('./ports').InstanceLeaderboardEntry[]> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.getLeaderboard(instanceId);
  }

  async getInstancePlayers(instanceId: string): Promise<import('./ports').QuizInstancePlayerRow[]> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);

    if (!instance) {
      throw new InstanceNotFoundError(INSTANCE_NOT_FOUND_MESSAGE);
    }

    return this.instanceRepository.listPlayers(instanceId);
  }

  async isPlayerInInstance(instanceId: string, userId: string): Promise<boolean> {
    const player = await this.instanceRepository.getPlayer(instanceId, userId);
    return player !== null;
  }

  async isHost(instanceId: string, userId: string): Promise<boolean> {
    const instance = await this.instanceRepository.getInstanceById(instanceId);
    return instance?.hostUserId === userId;
  }
}
