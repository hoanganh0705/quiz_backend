/// <reference types="jest" />
import { BookmarkCommandService } from './bookmark-command.service';
import { BookmarkAddedEvent, BookmarkRemovedEvent } from './events/bookmark-domain.events';

describe('BookmarkCommandService', () => {
  const NOW_ISO = '2026-07-19T09:00:00.000Z';

  function createService() {
    const bookmarkRepository = {
      addBookmarksBulk: jest.fn(),
      removeBookmarksBulk: jest.fn(),
    };
    const collectionRepository = {
      getCollectionById: jest.fn().mockResolvedValue({
        collectionId: 'collection-1',
        userId: 'user-1',
        name: 'Favorites',
        description: null,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO,
      }),
    };
    const eventBus = {
      emitBookmarkAdded: jest.fn(),
      emitBookmarkRemoved: jest.fn(),
    };
    const logger = {
      info: jest.fn(),
      warn: jest.fn(),
    };

    const service = new BookmarkCommandService(
      bookmarkRepository as never,
      collectionRepository as never,
      {} as never,
      eventBus as never,
      logger as never,
    );

    return { service, bookmarkRepository, eventBus };
  }

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(NOW_ISO));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits one BookmarkAddedEvent for each row actually inserted', async () => {
    const { service, bookmarkRepository, eventBus } = createService();
    bookmarkRepository.addBookmarksBulk.mockResolvedValue([
      { bookmarkId: 'bookmark-1', quizId: 'quiz-1' },
      { bookmarkId: 'bookmark-2', quizId: 'quiz-2' },
    ]);

    await expect(
      service.addBookmarksBulk('user-1', 'collection-1', ['quiz-1', 'quiz-2', 'quiz-2']),
    ).resolves.toBe(2);

    expect(bookmarkRepository.addBookmarksBulk).toHaveBeenCalledWith({
      userId: 'user-1',
      collectionId: 'collection-1',
      quizIds: ['quiz-1', 'quiz-2'],
      nowIso: NOW_ISO,
    });
    expect(eventBus.emitBookmarkAdded).toHaveBeenCalledTimes(2);
    expect(eventBus.emitBookmarkAdded).toHaveBeenNthCalledWith(
      1,
      new BookmarkAddedEvent('bookmark-1', 'collection-1', 'quiz-1', 'user-1', NOW_ISO),
    );
    expect(eventBus.emitBookmarkAdded).toHaveBeenNthCalledWith(
      2,
      new BookmarkAddedEvent('bookmark-2', 'collection-1', 'quiz-2', 'user-1', NOW_ISO),
    );
  });

  it('emits no add events when every requested pair already exists', async () => {
    const { service, bookmarkRepository, eventBus } = createService();
    bookmarkRepository.addBookmarksBulk.mockResolvedValue([]);

    await expect(service.addBookmarksBulk('user-1', 'collection-1', ['quiz-1'])).resolves.toBe(0);
    expect(eventBus.emitBookmarkAdded).not.toHaveBeenCalled();
  });

  it('emits one BookmarkRemovedEvent for each row actually deleted', async () => {
    const { service, bookmarkRepository, eventBus } = createService();
    bookmarkRepository.removeBookmarksBulk.mockResolvedValue([
      { bookmarkId: 'bookmark-1', quizId: 'quiz-1' },
      { bookmarkId: 'bookmark-2', quizId: 'quiz-2' },
    ]);

    await expect(
      service.removeBookmarksBulk('user-1', 'collection-1', ['quiz-1', 'quiz-2']),
    ).resolves.toBe(2);

    expect(eventBus.emitBookmarkRemoved).toHaveBeenCalledTimes(2);
    expect(eventBus.emitBookmarkRemoved).toHaveBeenNthCalledWith(
      1,
      new BookmarkRemovedEvent('bookmark-1', 'collection-1', 'quiz-1', 'user-1', NOW_ISO),
    );
    expect(eventBus.emitBookmarkRemoved).toHaveBeenNthCalledWith(
      2,
      new BookmarkRemovedEvent('bookmark-2', 'collection-1', 'quiz-2', 'user-1', NOW_ISO),
    );
  });

  it('emits no remove events when none of the requested pairs exist', async () => {
    const { service, bookmarkRepository, eventBus } = createService();
    bookmarkRepository.removeBookmarksBulk.mockResolvedValue([]);

    await expect(service.removeBookmarksBulk('user-1', 'collection-1', ['quiz-1'])).resolves.toBe(
      0,
    );
    expect(eventBus.emitBookmarkRemoved).not.toHaveBeenCalled();
  });
});
