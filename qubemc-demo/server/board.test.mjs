import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planBoard } from './board.mjs';
import { dispatchBoard, runNemoClawAgent } from './nemoclaw-discord.mjs';

const project = {
  workflowId: 'RED-BULL-X-LAUNCH-V1', businessDate: '2026-10-26', brief: 'Launch one post and one image.',
  document: { mediaType: 'text/markdown', content: '# Fictional launch\nThe outline precedes direction approval.' },
};

test('board sends the full document to NemoClaw and validates its two assignments', async () => {
  const tasks = await planBoard(project, new AbortController().signal, async prompt => {
    const data = JSON.parse(prompt.slice(prompt.indexOf('DATA:\n') + 6));
    assert.equal(data.workflowId, project.workflowId);
    assert.equal(data.document, project.document.content);
    return JSON.stringify({ outlineRequirements: 'Draft a one-page launch outline from approved facts.', outlineOwnerId: data.candidates[0].people[0].id,
      approvalRequirements: 'Review outline_v1 and approve the locked image headline.', approvalOwnerId: data.candidates[1].people.find(person => person.id !== data.candidates[0].people[0].id).id });
  });
  assert.deepEqual(tasks.map(task => task.id), ['RB-01', 'RB-02']);
  assert.deepEqual(tasks[1].dependencies, ['RB-01']);
  assert.ok(tasks.every(task => task.status === 'ready' && task.ownerId.startsWith('EMP-')));
});

test('board rejects missing or wrong workflow documents before invoking NemoClaw', async () => {
  let called = false;
  await assert.rejects(planBoard({ ...project, document: { ...project.document, content: '' } }, new AbortController().signal,
    async () => { called = true; return '{}'; }), /Invalid Red Bull/);
  assert.equal(called, false);
});

test('NemoClaw agent command parses the final payload', async () => {
  let called;
  const answer = await runNemoClawAgent('Return JSON', 'run-1', new AbortController().signal, async (file, args) => {
    called = { file, args };
    return { stdout: JSON.stringify({ result: { payloads: [{ text: '{"ok":true}' }] } }) };
  });
  assert.equal(answer, '{"ok":true}');
  assert.ok(called.args.join(' ').includes('openclaw'));
  assert.ok(called.args.join(' ').includes('--json'));
});

test('board dispatch fails closed when NemoClaw Discord has no mapping', async () => {
  await assert.rejects(dispatchBoard({ runId: 'test-run', tasks: [
    { id: 'RB-01', ownerId: 'EMP-0254', title: 'Outline', due: '10:00 AM', requirements: 'Draft.', dependencies: [] },
    { id: 'RB-02', ownerId: 'EMP-0308', title: 'Approval', due: '10:30 AM', requirements: 'Review.', dependencies: ['RB-01'] },
  ] }, async () => ({ id: '123' })), /NemoClaw Discord settings are incomplete/);
});
