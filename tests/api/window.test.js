import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from './harness.js';

/** An attendee's arrival and departure: saved as a pair, optional, departure may not precede arrival. */

let api;
let close;
let d0;
let d1;
const KENJI = 3;
const MARCUS = 5;

before(async () => {
  ({ api, close } = await startApi());
  [d0, d1] = (await api.json('/bootstrap')).days.map((d) => d.date);
});
after(() => close());

const windowOf = async (id) => {
  const u = await api.json(`/users/${id}`);
  return { arrival: u.arrival, departure: u.departure };
};
const MSG = "Departure can't be earlier than arrival";

describe('PUT /users/:id/window', () => {
  test('a new attendee has neither; saving stores both and a read returns them', async () => {
    assert.deepEqual(await windowOf(KENJI), { arrival: null, departure: null });
    const body = { arrival: { day: d0, time: '09:00' }, departure: { day: d1, time: '17:30' } };
    const res = await api.put(`/users/${KENJI}/window`, body);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { arrival: `${d0}T09:00`, departure: `${d1}T17:30` });
    assert.deepEqual(await windowOf(KENJI), res.body);
  });

  test('belongs to that attendee only', async () => {
    const before = await windowOf(MARCUS);
    await api.put(`/users/${KENJI}/window`, { arrival: { day: d1, time: '08:00' }, departure: null });
    assert.deepEqual(await windowOf(MARCUS), before);
  });

  test('one end alone is fine, and null/null clears', async () => {
    const only = await api.put(`/users/${KENJI}/window`, { arrival: null, departure: { day: d0, time: '12:00' } });
    assert.equal(only.status, 200);
    assert.deepEqual(only.body, { arrival: null, departure: `${d0}T12:00` });
    const cleared = await api.put(`/users/${KENJI}/window`, { arrival: null, departure: null });
    assert.deepEqual(cleared.body, { arrival: null, departure: null });
    assert.deepEqual(await windowOf(KENJI), { arrival: null, departure: null });
  });

  test('a departure earlier than the arrival is a 400 with the message and changes nothing', async () => {
    await api.put(`/users/${KENJI}/window`, { arrival: { day: d0, time: '09:00' }, departure: { day: d1, time: '10:00' } });
    const res = await api.put(`/users/${KENJI}/window`, { arrival: { day: d1, time: '10:00' }, departure: { day: d0, time: '18:00' } });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, MSG);
    const sameDay = await api.put(`/users/${KENJI}/window`, { arrival: { day: d0, time: '10:00' }, departure: { day: d0, time: '09:59' } });
    assert.equal(sameDay.status, 400);
    assert.equal(sameDay.body.error, MSG);
    assert.deepEqual(await windowOf(KENJI), { arrival: `${d0}T09:00`, departure: `${d1}T10:00` });
  });

  test('departure equal to arrival is accepted', async () => {
    const at = { day: d0, time: '10:00' };
    const res = await api.put(`/users/${KENJI}/window`, { arrival: at, departure: at });
    assert.equal(res.status, 200);
    await api.put(`/users/${KENJI}/window`, { arrival: null, departure: null });
  });

  test('a day that is not a conference day, or a bad time, is a 400; an unknown attendee is a 404', async () => {
    const bad = [
      { arrival: { day: '1999-01-01', time: '09:00' }, departure: null },
      { arrival: { day: d0, time: '9am' }, departure: null },
      { arrival: { day: d0, time: '25:00' }, departure: null },
      { arrival: { day: d0 }, departure: null },
      { arrival: '09:00', departure: null },
      {},
    ];
    for (const body of bad) {
      const res = await api.put(`/users/${KENJI}/window`, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.deepEqual(await windowOf(KENJI), { arrival: null, departure: null });
    assert.equal((await api.put('/users/9999/window', { arrival: null, departure: null })).status, 404);
  });
});
