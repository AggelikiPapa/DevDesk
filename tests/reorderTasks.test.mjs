import test from 'node:test';
import assert from 'node:assert/strict';
import { reorderTasks } from '../src/features/task-preview/reorderTasks.ts';

const tasks = Object.freeze(['KER-87', 'ENW-156', 'ABC-42'].map(issueKey =>
  Object.freeze({ issueKey, client: 'Sample', title: issueKey, status: 'Paused' })));
const keys = tasks => tasks.map(task => task.issueKey);

test('moves downward and upward without losing task data or mutating input', () => {
  const down = reorderTasks(tasks, 'KER-87', 'ABC-42');
  assert.deepEqual(keys(down), ['ENW-156', 'ABC-42', 'KER-87']);
  assert.equal(down[2], tasks[0]);
  assert.deepEqual(keys(reorderTasks(down, 'KER-87', 'ENW-156')), keys(tasks));
  assert.deepEqual(keys(tasks), ['KER-87', 'ENW-156', 'ABC-42']);
});

test('same target, unknown keys, and empty lists are harmless', () => {
  for (const pair of [['KER-87', 'KER-87'], ['missing', 'KER-87'], ['KER-87', 'missing']]) {
    assert.deepEqual(reorderTasks(tasks, ...pair), tasks);
  }
  assert.deepEqual(reorderTasks([], 'a', 'b'), []);
});
