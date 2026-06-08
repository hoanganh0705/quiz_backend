/// <reference types="jest" />
import { UserNotFoundError } from '@/modules/user/domain/errors';
import { ThreadNotFoundError } from '../errors';
import { DiscussionService } from './discussion.service';

describe('DiscussionService thread discovery operations', () => {
  const createService = () => {
    const repo = {
      getThreadById: jest.fn(),
      findRelatedThreads: jest.fn(),
      listThreadParticipants: jest.fn(),
      getPublicDiscussionProfile: jest.fn(),
    } as unknown as ConstructorParameters<typeof DiscussionService>[0];

    const quizExistence = {
      exists: jest.fn(),
    } as ConstructorParameters<typeof DiscussionService>[1];

    const userRepository = {
      findMeById: jest.fn(),
    } as ConstructorParameters<typeof DiscussionService>[2];

    const eventBus = {
      publish: jest.fn(),
    } as ConstructorParameters<typeof DiscussionService>[3];

    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as ConstructorParameters<typeof DiscussionService>[4];

    const service = new DiscussionService(
      repo as never,
      quizExistence as never,
      userRepository as never,
      eventBus as never,
      logger as never,
    );

    return {
      service,
      repo: repo as {
        getThreadById: jest.Mock;
        findRelatedThreads: jest.Mock;
        listThreadParticipants: jest.Mock;
        getPublicDiscussionProfile: jest.Mock;
      },
      userRepository: userRepository as {
        findMeById: jest.Mock;
      },
      logger: logger as {
        debug: jest.Mock;
        warn: jest.Mock;
      },
    };
  };

  describe('listRelatedDiscussions', () => {
    it('caps requested limit to 10 before querying repository', async () => {
      const { service, repo, logger } = createService();
      repo.getThreadById.mockResolvedValue({ threadId: 'thread-1' });
      repo.findRelatedThreads.mockResolvedValue([]);

      await service.listRelatedDiscussions('thread-1', { limit: 50 });

      expect(repo.findRelatedThreads).toHaveBeenCalledWith({ threadId: 'thread-1', limit: 10 });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'related_discussions_listed',
          requestedLimit: 50,
          appliedLimit: 10,
        }),
      );
    });

    it('returns repository results unchanged when related discussions exist', async () => {
      const { service, repo } = createService();
      const relatedThreads = [
        {
          threadId: 'thread-2',
          title: 'How does ranking XP work?',
          commentCount: 15,
          voteCount: 24,
          relevanceScore: 180,
        },
      ];

      repo.getThreadById.mockResolvedValue({ threadId: 'thread-1' });
      repo.findRelatedThreads.mockResolvedValue(relatedThreads);

      await expect(service.listRelatedDiscussions('thread-1', { limit: 5 })).resolves.toEqual(relatedThreads);
    });

    it('throws ThreadNotFoundError when base thread does not exist', async () => {
      const { service, repo, logger } = createService();
      repo.getThreadById.mockResolvedValue(null);

      await expect(service.listRelatedDiscussions('missing-thread', { limit: 5 })).rejects.toBeInstanceOf(
        ThreadNotFoundError,
      );

      expect(repo.findRelatedThreads).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'related_discussion_thread_not_found',
          threadId: 'missing-thread',
        }),
      );
    });
  });

  describe('listThreadParticipants', () => {
    it('returns repository participants unchanged when thread exists', async () => {
      const { service, repo, logger } = createService();
      const participants = [
        { userId: 'user-1', username: 'Anh', commentCount: 12 },
        { userId: 'user-2', username: 'John', commentCount: 5 },
      ];

      repo.getThreadById.mockResolvedValue({ threadId: 'thread-1' });
      repo.listThreadParticipants.mockResolvedValue(participants);

      await expect(service.listThreadParticipants('thread-1')).resolves.toEqual(participants);
      expect(repo.listThreadParticipants).toHaveBeenCalledWith('thread-1');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'thread_participants_listed',
          threadId: 'thread-1',
          resultCount: 2,
        }),
      );
    });

    it('throws ThreadNotFoundError when thread does not exist', async () => {
      const { service, repo, logger } = createService();
      repo.getThreadById.mockResolvedValue(null);

      await expect(service.listThreadParticipants('missing-thread')).rejects.toBeInstanceOf(ThreadNotFoundError);

      expect(repo.listThreadParticipants).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'thread_participants_thread_not_found',
          threadId: 'missing-thread',
        }),
      );
    });
  });

  describe('getPublicDiscussionProfile', () => {
    it('returns aggregated profile when user exists', async () => {
      const { service, repo, userRepository, logger } = createService();
      const profile = {
        threadsCreated: 42,
        commentsCreated: 310,
        acceptedAnswers: 18,
        reputation: 2340,
      };

      userRepository.findMeById.mockResolvedValue({ userId: 'user-1' });
      repo.getPublicDiscussionProfile.mockResolvedValue(profile);

      await expect(service.getPublicDiscussionProfile('user-1')).resolves.toEqual(profile);
      expect(repo.getPublicDiscussionProfile).toHaveBeenCalledWith('user-1');
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_profile_returned',
          userId: 'user-1',
          reputation: 2340,
        }),
      );
    });

    it('throws UserNotFoundError when user does not exist', async () => {
      const { service, repo, userRepository, logger } = createService();
      userRepository.findMeById.mockResolvedValue(null);

      await expect(service.getPublicDiscussionProfile('missing-user')).rejects.toBeInstanceOf(UserNotFoundError);

      expect(repo.getPublicDiscussionProfile).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'discussion_profile_user_not_found',
          userId: 'missing-user',
        }),
      );
    });
  });
});
