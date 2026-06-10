export class TagRepositoryConstraintError extends Error {
  constructor(
    readonly constraint: 'slug_conflict',
    message = 'Tag repository constraint violated',
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
