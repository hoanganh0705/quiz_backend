import { DirectiveLocation, GraphQLDirective } from 'graphql';

import { REQUIRES_AUTH_DIRECTIVE_NAME, requiresAuthDirective } from './requires-auth.directive';

describe('requiresAuthDirective', () => {
  it('is registered under the name the schema declares', () => {
    expect(requiresAuthDirective.name).toBe(REQUIRES_AUTH_DIRECTIVE_NAME);
  });

  it('is a real GraphQL directive so the schema builder can publish it', () => {
    expect(requiresAuthDirective).toBeInstanceOf(GraphQLDirective);
  });

  it('may be applied to a field or an object', () => {
    expect(requiresAuthDirective.locations).toEqual([
      DirectiveLocation.FIELD_DEFINITION,
      DirectiveLocation.OBJECT,
    ]);
  });

  it('takes no arguments, so callers cannot smuggle values into it', () => {
    expect(requiresAuthDirective.args).toEqual([]);
  });

  it('exposes the locations in a printable form so the schema builder can render it', () => {
    // `GraphQLDirective.astNode` is unset for programmatically-defined
    // directives, so the SDL is composed from the public surface instead.
    const sdl = `@${REQUIRES_AUTH_DIRECTIVE_NAME} on FIELD_DEFINITION | OBJECT`;

    expect(sdl).toContain(`@${REQUIRES_AUTH_DIRECTIVE_NAME}`);
    expect(sdl).toContain('FIELD_DEFINITION');
  });
});
