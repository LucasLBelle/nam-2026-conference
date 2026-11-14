import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's accessibility needs: PUT replaces the list, anything but the three options is refused. */

let api;
let close;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
});
after(() => close());

const needsOf = async (id) => (await api.json(`/users/${id}`)).accessNeeds;

describe('PUT /users/:id/access-needs', () => {
  test('starts empty, saves the list, replies with it, and a read returns it', async () => {
    assert.deepEqual(await needsOf(KENJI), []);
    const res = await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: ['step-free', 'quiet'] });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { accessNeeds: ['step-free', 'quiet'] });
    assert.deepEqual(await needsOf(KENJI), ['step-free', 'quiet']);
  });

  test('belongs to that attendee only', async () => {
    await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: ['hearing'] });
    assert.deepEqual(await needsOf(MARCUS), []);
  });

  test('drops duplicates and an empty list clears', async () => {
    const res = await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: ['hearing', 'hearing'] });
    assert.deepEqual(res.body.accessNeeds, ['hearing']);
    const cleared = await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: [] });
    assert.equal(cleared.status, 200);
    assert.deepEqual(await needsOf(KENJI), []);
  });

  test('an unknown option is a 400 and changes nothing', async () => {
    await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: ['quiet'] });
    const res = await api.put(`/users/${KENJI}/access-needs`, { accessNeeds: ['step-free', 'jetpack'] });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, 'unknown accessibility need: jetpack');
    assert.deepEqual(await needsOf(KENJI), ['quiet']);
  });

  test('a body that is not a list of names is a 400', async () => {
    for (const body of [{}, { accessNeeds: 'quiet' }, { accessNeeds: [1] }]) {
      const res = await api.put(`/users/${KENJI}/access-needs`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.put('/users/999999/access-needs', { accessNeeds: [] });
    assert.equal(res.status, 404);
  });
});
