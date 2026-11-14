import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewAgenda, recommend, withSessions } from '../../src/lib/agendaView.js';

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

const r = (id, day, startsAt, endsAt, topics = [], kind = 'topic') =>
  ({ id, day, startsAt, endsAt, durationMins: 60, tags: topics.map((name) => ({ name, kind })) });
const catalogue = [
  r(1, '2030-01-02', '09:00', '10:00', ['AI']),
  r(2, '2030-01-02', '11:00', '12:00', ['Cloud']),
  r(3, '2030-01-02', '13:00', '14:00', ['Data']),
  r(4, '2030-01-03', '09:00', '10:00', ['AI', 'Data']),
  r(5, '2030-01-03', '10:00', '11:00', ['Security']),
  r(6, '2030-01-03', '12:00', '13:00', ['AI'], 'level'),
];
const now = { day: '2030-01-02', time: '10:30' };

test('recommend: any interest matches, ended and held sessions drop, soonest first', () => {
  const held = (id) => ({ 3: 'waitlisted' })[id] ?? null;
  const out = recommend(catalogue, ['AI', 'Cloud', 'Data'], held, now, 8);
  // 1 has ended, 3 is held (waitlisted counts), 6 is a level tag not a topic
  assert.deepEqual(out.map((x) => x.id), [2, 4]);
});

test('recommend: no interests, nothing; limit caps; a confirmed seat drops too', () => {
  assert.deepEqual(recommend(catalogue, [], () => null, now, 8), []);
  assert.deepEqual(recommend(catalogue, ['AI', 'Cloud', 'Data'], () => null, now, 1).map((x) => x.id), [2]);
  assert.deepEqual(recommend(catalogue, ['Cloud'], () => 'confirmed', now, 8), []);
});

test('recommend: a session starting later today but not over yet stays; one that just ended goes', () => {
  const edge = [r(7, '2030-01-02', '10:00', '10:30', ['AI']), r(8, '2030-01-02', '10:30', '11:30', ['AI'])];
  assert.deepEqual(recommend(edge, ['AI'], () => null, now, 8).map((x) => x.id), [8]);
});

test('withSessions: merges into existing days, adds missing days, dedupes by id', () => {
  const base = [{ date: '2030-01-02', sessions: [s(1, '09:00', 60)] }];
  const out = withSessions(base, [
    { id: 1, day: '2030-01-02', startsAt: '09:00', durationMins: 60 },
    { id: 2, day: '2030-01-02', startsAt: '10:00', durationMins: 60 },
    { id: 3, day: '2030-01-03', startsAt: '09:00', durationMins: 60 },
  ]);
  assert.deepEqual(out.map((d) => [d.date, d.sessions.map((x) => x.id)]), [['2030-01-02', [1, 2]], ['2030-01-03', [3]]]);
  assert.deepEqual(base[0].sessions.map((x) => x.id), [1]);
});

// Window: arrival/departure are `YYYY-MM-DDTHH:MM`, like `?at=`. A session must fit wholly inside.
const win = [
  r(21, '2030-01-02', '09:00', '10:00', ['AI']),
  r(22, '2030-01-02', '11:00', '12:00', ['AI']),
  r(23, '2030-01-02', '13:00', '14:00', ['AI']),
  r(24, '2030-01-03', '09:00', '10:00', ['AI']),
];
const early = { day: '2030-01-01', time: '08:00' };
const ids = (w) => recommend(win, ['AI'], () => null, early, 8, w).map((x) => x.id);

test('recommend window: neither set excludes nothing', () => {
  assert.deepEqual(ids({}), [21, 22, 23, 24]);
  assert.deepEqual(ids({ arrival: null, departure: null }), [21, 22, 23, 24]);
  assert.deepEqual(recommend(win, ['AI'], () => null, early, 8), [21, 22, 23, 24].map((id) => win.find((s) => s.id === id)));
});

test('recommend window: before, inside and after', () => {
  assert.deepEqual(ids({ arrival: '2030-01-02T10:30', departure: '2030-01-02T12:30' }), [22]);
});

test('recommend window: only arrival, only departure', () => {
  assert.deepEqual(ids({ arrival: '2030-01-02T11:00' }), [22, 23, 24]);
  assert.deepEqual(ids({ departure: '2030-01-02T14:00' }), [21, 22, 23]);
});

test('recommend window: a session straddling an edge is excluded, one touching it stays', () => {
  assert.deepEqual(ids({ arrival: '2030-01-02T09:30', departure: '2030-01-02T13:30' }), [22]);
  assert.deepEqual(ids({ arrival: '2030-01-02T09:00', departure: '2030-01-02T10:00' }), [21]);
});

test('recommend window: days count, not just times', () => {
  assert.deepEqual(ids({ arrival: '2030-01-03T00:00' }), [24]);
  assert.deepEqual(ids({ departure: '2030-01-02T23:59' }), [21, 22, 23]);
});

// A maximum level moves sessions above it after every one at or below; nothing is removed.
const lv = (id, startsAt, level) => ({ ...r(id, '2030-01-02', startsAt, `${startsAt.slice(0, 2)}:59`, ['AI']), level });
const early = { day: '2030-01-02', time: '07:00' };
const levels = [
  lv(1, '08:00', 'Advanced'), lv(2, '09:00', 'Beginner'), lv(3, '10:00', 'Intermediate'),
  lv(4, '11:00', 'Advanced'), lv(5, '12:00', 'All Levels'),
];
const byLevel = (max, limit = 8, list = levels) =>
  recommend(list, ['AI'], () => null, early, limit, {}, max).map((x) => x.id);

test('recommend: above the maximum comes after everything at or below it, each group soonest first', () => {
  assert.deepEqual(byLevel('Intermediate'), [2, 3, 5, 1, 4]);
  assert.deepEqual(byLevel('Beginner'), [2, 5, 1, 3, 4]);
  assert.deepEqual(byLevel('Advanced'), [1, 2, 3, 4, 5]);
});

test('recommend: "All Levels" ranks as at or below any maximum', () => {
  assert.deepEqual(byLevel('Beginner', 8, [lv(1, '08:00', 'Advanced'), lv(2, '12:00', 'All Levels')]), [2, 1]);
});

test('recommend: no maximum, null or omitted, leaves the soonest-first order', () => {
  assert.deepEqual(byLevel(null), [1, 2, 3, 4, 5]);
  assert.deepEqual(byLevel(undefined), [1, 2, 3, 4, 5]);
  assert.deepEqual(recommend(levels, ['AI'], () => null, early).map((x) => x.id), [1, 2, 3, 4, 5]);
});

test('recommend: the limit applies after the reorder, so above-maximum sessions show only when the rest run out', () => {
  assert.deepEqual(byLevel('Beginner', 2), [2, 5]);
  assert.deepEqual(byLevel('Beginner', 3), [2, 5, 1]);
});
