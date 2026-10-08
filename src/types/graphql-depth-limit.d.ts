/**
 * Ambient declarations for `graphql-depth-limit`.
 *
 * The published package ships JavaScript only, so its validator has to be
 * described locally for the project to typecheck.
 */
declare module 'graphql-depth-limit' {
  import type { ValidationContext } from 'graphql';

  type IgnoreRule = string | RegExp | ((fieldName: string) => boolean);

  type DepthLimitOptions = {
    ignore?: IgnoreRule | IgnoreRule[];
  };

  type DepthCallback = (depthsByOperation: Record<string, number>) => void;

  function depthLimit(
    maxDepth: number,
    options?: DepthLimitOptions,
    callback?: DepthCallback,
  ): (context: ValidationContext) => ValidationContext;

  export = depthLimit;
}
