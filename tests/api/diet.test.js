import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's dietary requirement: one of three, or null; anything else is refused. */

let api;
let close;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
});
after(() => close());

const dietOf = async (id) => (await api.json(`/users/${id}`)).diet;

describe('PUT /users/:id/diet', () => {
  test('starts unset, saves, replies with it, and a read returns it', async () => {
    assert.equal(await dietOf(KENJI), null);
    const res = await api.put(`/users/${KENJI}/diet`, { diet: 'vegan' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { diet: 'vegan' });
    assert.equal(await dietOf(KENJI), 'vegan');
  });

  test('belongs to that attendee only', async () => {
    await api.put(`/users/${KENJI}/diet`, { diet: 'gluten-free' });
    assert.equal(await dietOf(MARCUS), null);
  });

  test('null clears', async () => {
    await api.put(`/users/${KENJI}/diet`, { diet: 'vegetarian' });
    const res = await api.put(`/users/${KENJI}/diet`, { diet: null });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { diet: null });
    assert.equal(await dietOf(KENJI), null);
  });

  test('an unknown option, a number or no body is a 400 and changes nothing', async () => {
    await api.put(`/users/${KENJI}/diet`, { diet: 'vegan' });
    for (const body of [{ diet: 'keto' }, { diet: 5 }, {}]) {
      const res = await api.put(`/users/${KENJI}/diet`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(await dietOf(KENJI), 'vegan');
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.put('/users/999999/diet', { diet: 'vegan' });
    assert.equal(res.status, 404);
  });
});
