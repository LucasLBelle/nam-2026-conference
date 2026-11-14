import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, shotForPR } from './helpers.js';

// One walk: set arrival and departure on My Profile (a departure before the arrival is refused with its
// message and nothing is saved), reload and see them, then My Agenda's recommendations lose the sessions
// before and after the window, and clearing both brings them back. The clock is pinned before Day 1's first slot.
test('arrival and departure on My Profile narrow My Agenda recommendations', async ({ page, request }, testInfo) => {
  const lane = await laneFor('profile.window', testInfo);
  const at = await momentOn(0, '07:00');
  const original = await (await request.get(`${API}/users/${lane.user}`)).json();
  const sessions = await (await request.get(`${API}/sessions`)).json();
  const held = new Set(original.reservations.map((r) => r.sessionId));
  const byTopic = (topic) => sessions
    .filter((s) => s.day === lane.day && !held.has(s.id) && s.tags.some((t) => t.kind === 'topic' && t.name === topic))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id)
    .slice(0, 8); // the page shows the first eight
  // Three back-to-back-or-apart sessions of one topic: one before, one inside, one after the window.
  let trio = null;
  let topic = null;
  for (const t of new Set(sessions.flatMap((s) => s.tags.filter((x) => x.kind === 'topic').map((x) => x.name)))) {
    const list = byTopic(t);
    for (const b of list) {
      const a = list.find((s) => s.endsAt <= b.startsAt);
      const c = list.find((s) => s.startsAt >= b.endsAt);
      if (a && c) { trio = { a, b, c }; topic = t; break; }
    }
    if (trio) break;
  }
  expect(trio, 'a topic with sessions before, inside and after on the lane day').not.toBeNull();
  const { a, b, c } = trio;
  const put = (interests, arrival = null, departure = null) => Promise.all([
    request.put(`${API}/users/${lane.user}/interests`, { data: { interests } }),
    request.put(`${API}/users/${lane.user}/window`, { data: { arrival, departure } }),
  ]);
  const rec = (s) => page.getByTestId('recommendation').filter({ hasText: s.title });

  try {
    await put([topic]);

    // No window: nothing is excluded.
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(rec(a)).toBeVisible();
    await expect(rec(b)).toBeVisible();
    await expect(rec(c)).toBeVisible();

    // Profile: departure before arrival is refused with a message, nothing saved.
    await visit(page, '/profile', { as: lane.user, at });
    const box = page.getByTestId('profile-window');
    await box.getByTestId('arrival-day').selectOption(lane.day);
    await box.getByTestId('arrival-time').fill(b.startsAt);
    await box.getByTestId('departure-day').selectOption(lane.day);
    await box.getByTestId('departure-time').fill(a.startsAt);
    await box.getByTestId('window-save').click();
    await expect(page.getByText("Departure can't be earlier than arrival")).toBeVisible();
    await page.reload();
    await expect(box.getByTestId('arrival-time')).toHaveValue('');
    await expect(box.getByTestId('departure-time')).toHaveValue('');

    // A valid window around b: saved, shown after reload.
    await box.getByTestId('arrival-day').selectOption(lane.day);
    await box.getByTestId('arrival-time').fill(b.startsAt);
    await box.getByTestId('departure-day').selectOption(lane.day);
    await box.getByTestId('departure-time').fill(b.endsAt);
    await box.getByTestId('window-save').click();
    await expect(async () => {
      const u = await (await request.get(`${API}/users/${lane.user}`)).json();
      expect(u.arrival).toBe(`${lane.day}T${b.startsAt}`);
      expect(u.departure).toBe(`${lane.day}T${b.endsAt}`);
    }).toPass();
    await page.reload();
    await expect(box.getByTestId('arrival-day')).toHaveValue(lane.day);
    await expect(box.getByTestId('arrival-time')).toHaveValue(b.startsAt);
    await expect(box.getByTestId('departure-time')).toHaveValue(b.endsAt);
    await shotForPR(page, 'Arriving and leaving on My Profile');

    // My Agenda: the sessions before and after drop out, the one inside stays.
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(rec(b)).toBeVisible();
    await expect(rec(a)).toHaveCount(0);
    await expect(rec(c)).toHaveCount(0);
    await shotForPR(page, 'Recommendations inside the arrival and departure window');

    // Clear both on the profile: everything is recommended again.
    await visit(page, '/profile', { as: lane.user, at });
    await box.getByTestId('window-clear-arrival').click();
    await expect(async () => {
      expect((await (await request.get(`${API}/users/${lane.user}`)).json()).arrival).toBeNull();
    }).toPass();
    await box.getByTestId('window-clear-departure').click();
    await expect(async () => {
      expect((await (await request.get(`${API}/users/${lane.user}`)).json()).departure).toBeNull();
    }).toPass();
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(rec(a)).toBeVisible();
    await expect(rec(c)).toBeVisible();
  } finally {
    await put(original.interests);
  }
});
