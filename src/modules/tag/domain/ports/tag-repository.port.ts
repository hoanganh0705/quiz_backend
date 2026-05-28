export interface TagRow {
  tagId: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagRepositoryPort {
  findById(tagId: string): Promise<TagRow | null>;
  findBySlug(slug: string): Promise<TagRow | null>;
  findMany(params: {
    limit: number;
    cursor?: { createdAt: string; tagId: string } | null;
  }): Promise<TagRow[]>;
  create(params: { name: string; slug: string; nowIso: string }): Promise<TagRow>;
  update(params: {
    tagId: string;
    patch: { name?: string; slug?: string };
    nowIso: string;
  }): Promise<TagRow | null>;
  softDelete(tagId: string, nowIso: string): Promise<boolean>;
}

export const TAG_REPOSITORY_PORT = Symbol('TAG_REPOSITORY_PORT');
