export const CATEGORY_DOMAIN_EVENT_BUS = Symbol('CATEGORY_DOMAIN_EVENT_BUS');

export interface CategoryDomainEventBusPort {
  subscribe(handler: (event: unknown) => void): () => void;
  emitCategoryCreated(event: { categoryId: string; slug: string; nowIso: string }): void;
  emitCategoryUpdated(event: { categoryId: string; slug: string; nowIso: string }): void;
  emitCategoryDeleted(event: { categoryId: string; slug: string; nowIso: string }): void;
  emitCategoryRestored(event: { categoryId: string; slug: string; nowIso: string }): void;
}
