// Runs the original 58 engine scenarios (agentEngine.scenarios.js) under Vitest.
import { createRequire } from 'node:module';
import { describe, it, expect, beforeAll } from 'vitest';

const require = createRequire(import.meta.url);
const { runTests } = require('./agentEngine.scenarios.js');

describe('agent engine scenarios', () => {
  let outcome;

  beforeAll(async () => {
    outcome = await runTests();
  });

  it('runs all 58 original assertions', () => {
    expect(outcome.total).toBe(58);
  });

  it('passes every assertion', () => {
    const failures = outcome.results
      .filter((r) => !r.ok)
      .map((r) => `${r.section} › ${r.name}: ${r.details}`);
    expect(failures).toEqual([]);
  });
});
