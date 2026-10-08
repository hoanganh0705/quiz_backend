// @ts-check
'use strict';

const noSoftDeleteLeakRule = require('./no-soft-delete-leak');
const noBlockingRedisOnSharedClientRule = require('./no-blocking-redis-on-shared-client');
const noRawRedisKeysRule = require('./no-raw-redis-keys');
const noUnlockedSchedulerRule = require('./no-unlocked-scheduler');

module.exports = {
  meta: {
    name: 'quiz-backend-local-rules',
  },
  rules: {
    'no-soft-delete-leak': noSoftDeleteLeakRule,
    'no-blocking-redis-on-shared-client': noBlockingRedisOnSharedClientRule,
    'no-raw-redis-keys': noRawRedisKeysRule,
    'no-unlocked-scheduler': noUnlockedSchedulerRule,
  },
};
