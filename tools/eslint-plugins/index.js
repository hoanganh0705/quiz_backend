// @ts-check
'use strict';

const noSoftDeleteLeakRule = require('./no-soft-delete-leak');

module.exports = {
  meta: {
    name: 'quiz-backend-local-rules',
  },
  rules: {
    'no-soft-delete-leak': noSoftDeleteLeakRule,
  },
};
