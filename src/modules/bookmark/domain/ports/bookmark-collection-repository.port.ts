export type BookmarkCollectionRow = {
  collectionId: string;
  userId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BookmarkCollectionWithCountRow = BookmarkCollectionRow & {
  quizCount: number;
};

export interface BookmarkCollectionRepositoryPort {
  getCollectionById(collectionId: string): Promise<BookmarkCollectionRow | null>;

  listCollectionsByUser(userId: string): Promise<BookmarkCollectionWithCountRow[]>;

  createCollection(params: {
    userId: string;
    name: string;
    description: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow>;

  updateCollection(params: {
    collectionId: string;
    name?: string;
    description?: string | null;
    nowIso: string;
  }): Promise<BookmarkCollectionRow>;

  deleteCollection(collectionId: string): Promise<void>;
}

export const BOOKMARK_COLLECTION_REPOSITORY_PORT = Symbol('BOOKMARK_COLLECTION_REPOSITORY_PORT');
