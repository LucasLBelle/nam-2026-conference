import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's job title: free text up to 100 characters; empty clears it. */

let api;
let close;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
});
after(() => close());

const titleOf = async (id) => (await api.json(`/users/${id}`)).jobTitle;

describe('PUT /users/:id/job-title', () => {
  test('saves, replies with it, and a read returns it', async () => {
    const res = await api.put(`/users/${KENJI}/job-title`, { jobTitle: 'Staff Engineer' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { jobTitle: 'Staff Engineer' });
    assert.equal(await titleOf(KENJI), 'Staff Engineer');
  });

  test('belongs to that attendee only', async () => {
    const before = await titleOf(MARCUS);
    await api.put(`/users/${KENJI}/job-title`, { jobTitle: 'Only Kenji' });
    assert.equal(await titleOf(MARCUS), before);
  });

  test('trims surrounding spaces', async () => {
    const res = await api.put(`/users/${KENJI}/job-title`, { jobTitle: '  Designer  ' });
    assert.deepEqual(res.body, { jobTitle: 'Designer' });
  });

  test('empty, all-space and null clear it to null', async () => {
    for (const jobTitle of ['', '   ', null]) {
      await api.put(`/users/${KENJI}/job-title`, { jobTitle: 'Something' });
      const res = await api.put(`/users/${KENJI}/job-title`, { jobTitle });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body, { jobTitle: null });
      assert.equal(await titleOf(KENJI), null);
    }
  });

  test('100 characters is accepted, 101 is refused and the old title stays', async () => {
    const ok = await api.put(`/users/${KENJI}/job-title`, { jobTitle: 'a'.repeat(100) });
    assert.equal(ok.status, 200);
    const res = await api.put(`/users/${KENJI}/job-title`, { jobTitle: 'b'.repeat(101) });
    assert.equal(res.status, 400);
    assert.equal(await titleOf(KENJI), 'a'.repeat(100));
  });

  test('a non-string or missing title is a 400', async () => {
    assert.equal((await api.put(`/users/${KENJI}/job-title`, { jobTitle: 5 })).status, 400);
    assert.equal((await api.put(`/users/${KENJI}/job-title`, {})).status, 400);
  });

  test('an unknown attendee is a 404', async () => {
    assert.equal((await api.put('/users/99999/job-title', { jobTitle: 'x' })).status, 404);
  });
});
