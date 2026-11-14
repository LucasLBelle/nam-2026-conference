import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's topic interests: PUT replaces the list, anything but a topic tag is refused. */

let api;
let close;
let topics;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
  topics = (await api.json('/bootstrap')).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
});
after(() => close());

const interestsOf = async (id) => (await api.json(`/users/${id}`)).interests;

describe('PUT /users/:id/interests', () => {
  test('saves the list, replies with it, and a read returns it', async () => {
    const pick = [topics[0], topics[1]];
    const res = await api.put(`/users/${KENJI}/interests`, { interests: pick });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { interests: pick });
    assert.deepEqual(await interestsOf(KENJI), pick);
  });

  test('belongs to that attendee only', async () => {
    const before = await interestsOf(MARCUS);
    await api.put(`/users/${KENJI}/interests`, { interests: [topics[2]] });
    assert.deepEqual(await interestsOf(MARCUS), before);
  });

  test('drops duplicates and an empty list clears', async () => {
    const res = await api.put(`/users/${KENJI}/interests`, { interests: [topics[0], topics[0]] });
    assert.deepEqual(res.body.interests, [topics[0]]);
    const cleared = await api.put(`/users/${KENJI}/interests`, { interests: [] });
    assert.equal(cleared.status, 200);
    assert.deepEqual(await interestsOf(KENJI), []);
  });

  test('an unknown tag or a non-topic tag is a 400 and changes nothing', async () => {
    await api.put(`/users/${KENJI}/interests`, { interests: [topics[3]] });
    for (const bad of ['Not A Real Tag', 'Python']) {
      const res = await api.put(`/users/${KENJI}/interests`, { interests: [topics[0], bad] });
      assert.equal(res.status, 400, bad);
      assert.equal(res.body.error, `unknown topic: ${bad}`);
      assert.deepEqual(await interestsOf(KENJI), [topics[3]]);
    }
  });

  test('a body that is not a list of names is a 400', async () => {
    for (const body of [{}, { interests: 'AI' }, { interests: [1] }]) {
      const res = await api.put(`/users/${KENJI}/interests`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('an unknown attendee is a 404', async () => {
    const res = await api.put('/users/999999/interests', { interests: [] });
    assert.equal(res.status, 404);
    assert.match(res.body.error, /not found/i);
  });
});
