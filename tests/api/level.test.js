import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's highest comfortable session level: one of three, or null; anything else is refused. */

let api;
let close;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
});
after(() => close());

const levelOf = async (id) => (await api.json(`/users/${id}`)).maxLevel;

describe('PUT /users/:id/level', () => {
  test('starts unset, saves, replies with it, and a read returns it', async () => {
    assert.equal(await levelOf(KENJI), null);
    const res = await api.put(`/users/${KENJI}/level`, { level: 'Intermediate' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { level: 'Intermediate' });
    assert.equal(await levelOf(KENJI), 'Intermediate');
  });

  test('belongs to that attendee only', async () => {
    await api.put(`/users/${KENJI}/level`, { level: 'Beginner' });
    assert.equal(await levelOf(MARCUS), null);
  });

  test('null clears', async () => {
    await api.put(`/users/${KENJI}/level`, { level: 'Advanced' });
    const res = await api.put(`/users/${KENJI}/level`, { level: null });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { level: null });
    assert.equal(await levelOf(KENJI), null);
  });

  test('an unknown option (All Levels included), a number or no body is a 400 and changes nothing', async () => {
    await api.put(`/users/${KENJI}/level`, { level: 'Beginner' });
    for (const body of [{ level: 'All Levels' }, { level: 'Expert' }, { level: 5 }, {}]) {
      const res = await api.put(`/users/${KENJI}/level`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(await levelOf(KENJI), 'Beginner');
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.put('/users/999999/level', { level: 'Beginner' });
    assert.equal(res.status, 404);
  });
});
