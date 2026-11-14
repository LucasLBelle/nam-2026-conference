import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewAgenda } from '../../src/lib/agendaView.js';

const s = (id, startsAt, durationMins) => ({ id, startsAt, durationMins });
const days = [
  { date: '2030-01-02', sessions: [s(3, '14:00', 30), s(2, '10:00', 90), s(1, '09:00', 60)] },
  { date: '2030-01-03', sessions: [s(4, '09:00', 45)] },
];
const statuses = (m) => (id) => m[id] ?? null;

test('groups by day, orders by start time and carries each status', () => {
  const v = viewAgenda(days, statuses({ 1: 'confirmed', 2: 'waitlisted', 3: 'confirmed', 4: 'confirmed' }));
  assert.deepEqual(v.days.map((d) => d.sessions.map((x) => [x.id, x.status])),
    [[[1, 'confirmed'], [2, 'waitlisted'], [3, 'confirmed']], [[4, 'confirmed']]]);
});

test('booked time counts confirmed seats only; waitlisted time is totalled apart', () => {
  const v = viewAgenda(days, statuses({ 1: 'confirmed', 2: 'waitlisted' }));
  assert.equal(v.bookedMinutes, 60);
  assert.equal(v.waitlistedMinutes, 90);
  assert.equal(v.days[0].bookedMinutes, 60);
  assert.equal(v.days[0].waitlistedMinutes, 90);
});

test('a session the store no longer holds drops out, and an emptied day with it', () => {
  const v = viewAgenda(days, statuses({ 4: 'confirmed' }));
  assert.deepEqual(v.days.map((d) => d.date), ['2030-01-03']);
  assert.equal(v.bookedMinutes, 45);
  assert.equal(v.waitlistedMinutes, 0);
});

test('nothing held gives no days and zero totals', () => {
  const v = viewAgenda(days, statuses({}));
  assert.deepEqual(v, { days: [], bookedMinutes: 0, waitlistedMinutes: 0 });
});
