/**
 * `@requiresAuth` schema directive.
 *
 * Marks a field as gated behind a verified access token. Anonymous callers
 * receive `null` rather than an error, so a single query can serve both a
 * signed-in and a signed-out reader without the client branching on the
 * response shape.
 */
import { DirectiveLocation, GraphQLDirective } from 'graphql';

export const REQUIRES_AUTH_DIRECTIVE_NAME = 'requiresAuth';

export const requiresAuthDirective = new GraphQLDirective({
  name: REQUIRES_AUTH_DIRECTIVE_NAME,
  description: 'Field is only resolved for callers with a verified access token.',
  locations: [DirectiveLocation.FIELD_DEFINITION, DirectiveLocation.OBJECT],
});
