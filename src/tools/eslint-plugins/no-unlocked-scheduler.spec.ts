import { RuleTester } from '@typescript-eslint/rule-tester';
import tsParser from '@typescript-eslint/parser';
import rule from '../../../tools/eslint-plugins/no-unlocked-scheduler';

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  },
});

const sample = (
  code: string,
  filename = '/repo/src/modules/sample.ts',
): { code: string; filename: string } => ({
  code,
  filename,
});

describe('no-unlocked-scheduler', () => {
  describe('@Cron handler must acquire the scheduler lock', () => {
    ruleTester.run('no-unlocked-scheduler', rule, {
      valid: [
        sample(
          `
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    await acquireSchedulerLockOrRecordSkip({ lockKey: 'foo:lock', lockTtlMs: 60_000 }, async () => {
      return;
    });
  }
}
`,
        ),
        sample(
          `
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    if (!this.isShuttingDown) {
      const lockToken = await acquireSchedulerLockOrRecordSkip({
        cache: this.cache,
        lockKey: 'foo',
        lockTtlMs: 60_000,
        job: 'foo',
      });
      if (lockToken === null) return;
      try {
        await this.run();
      } finally {
        await this.cache.releaseAdvisoryLock('foo', lockToken);
      }
    }
  }
}
`,
        ),
        sample(`
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    await this.runIfLockAcquired({
      lockKey: 'foo',
      job: 'foo',
      body: async () => { return; },
    });
  }

  private async runIfLockAcquired(args: { lockKey: string; job: string; body: () => Promise<void> }): Promise<void> {
    const token = await acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      lockKey: args.lockKey,
      lockTtlMs: 60_000,
      job: args.job,
    });
    if (token === null) return;
    try { await args.body(); }
    finally { await this.cache.releaseAdvisoryLock(args.lockKey, token); }
  }
}
`),
        sample(`
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    await this.runCleanup();
  }
  private async runCleanup(): Promise<void> {
    const token = await this.acquireLockOrSkip();
    if (token === null) return;
    try {
      return;
    } finally {
      await this.cache.releaseAdvisoryLock('foo', token);
    }
  }
  private async acquireLockOrSkip(): Promise<string | null> {
    return acquireSchedulerLockOrRecordSkip({
      cache: this.cache,
      lockKey: 'foo',
      lockTtlMs: 60_000,
      job: 'foo',
    });
  }
}
`),
        sample(`class Foo { doWork(): void {} handleClick(): void {} }`),
      ],
      invalid: [
        {
          ...sample(`
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    await this.run();
  }
  private async run(): Promise<void> {
    return;
  }
}
`),
          errors: [{ messageId: 'missingLockHelper' }],
        },
        {
          ...sample(`
import { Cron } from '@nestjs/schedule';
class Foo {
  @Cron('0 * * * *')
  async tick(): Promise<void> {
    return;
  }
}
`),
          errors: [{ messageId: 'missingLockHelper' }],
        },
      ],
    });
  });

  describe('internal helpers', () => {
    it('referencesLockPrimitive finds the call anywhere in the tree', () => {
      const ast = {
        type: 'BlockStatement',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'Identifier',
                name: 'acquireSchedulerLockOrRecordSkip',
              },
              arguments: [],
            },
          },
        ],
      } as never;
      expect(rule.__internals.referencesLockPrimitive(ast)).toBe(true);
    });

    it('collectThisCallTargets returns all this.x callee names', () => {
      const ast = {
        type: 'BlockStatement',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'ThisExpression' },
                property: { type: 'Identifier', name: 'runIfLockAcquired' },
              },
              arguments: [],
            },
          },
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { type: 'ThisExpression' },
                property: { type: 'Identifier', name: 'helpMe' },
              },
              arguments: [],
            },
          },
        ],
      } as never;
      const targets = rule.__internals.collectThisCallTargets(ast);
      expect(targets.has('runIfLockAcquired')).toBe(true);
      expect(targets.has('helpMe')).toBe(true);
    });

    it('isLockWrapperName matches the canonical patterns', () => {
      expect(rule.__internals.isLockWrapperName('runIfLockAcquired')).toBe(true);
      expect(rule.__internals.isLockWrapperName('acquireLockOrSkip')).toBe(true);
      expect(rule.__internals.isLockWrapperName('AcquireLockOrSkip')).toBe(true);
      expect(rule.__internals.isLockWrapperName('runCleanup')).toBe(true);
      expect(rule.__internals.isLockWrapperName('runTick')).toBe(true);
      expect(rule.__internals.isLockWrapperName('handleBar')).toBe(false);
    });

    it('hasCronDecorator recognises both bare and call-shaped @Cron', () => {
      expect(
        rule.__internals.hasCronDecorator([{ expression: { type: 'Identifier', name: 'Cron' } }]),
      ).toBe(true);
      expect(
        rule.__internals.hasCronDecorator([
          {
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'Cron' },
              arguments: [],
            },
          },
        ]),
      ).toBe(true);
      expect(
        rule.__internals.hasCronDecorator([
          {
            expression: {
              type: 'CallExpression',
              callee: { type: 'Identifier', name: 'Interval' },
              arguments: [],
            },
          },
        ]),
      ).toBe(false);
    });
  });
});
