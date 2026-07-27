/**
 * Discussion Module — public surface.
 *
 * The module class itself (`DiscussionModule`) is the only symbol a
 * parent module (e.g. `app.module.ts`) needs. Domain ports, event types,
 * and the bus symbol are imported directly from their respective
 * `domain/*` paths by cross-module consumers.
 *
 * This barrel is intentionally narrow so the public surface of the
 * module is grep-able and reviewable in one place.
 */

export { DiscussionModule } from './discussion.module';
