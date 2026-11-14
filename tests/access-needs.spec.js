import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, shotForPR } from './helpers.js';

// One walk: the three needs on My Profile (select, reload, clear, per attendee), then the
// "Not step-free" flag on the session page, the agenda row and the recommendation, only with step-free set.
test('accessibility needs on My Profile flag non-step-free rooms, only when step-free is set', async ({ page, request }, testInfo) => {
  const lane = await laneFor('access.needs', testInfo);
  const at = await momentOn(0, '07:00');
  const now = { day: at.slice(0, 10), time: '07:00' };
  const other = 3; // an attendee this test never writes
  const put = (id, accessNeeds) => request.put(`${API}/users/${id}/access-needs`, { data: { accessNeeds } });
  const originalNeeds = (await (await request.get(`${API}/users/${lane.user}`)).json()).accessNeeds;
  const originalInterests = (await (await request.get(`${API}/users/${lane.user}`)).json()).interests;

  // Two sessions in rooms without step-free access: one to book, one to be recommended.
  const all = await (await request.get(`${API}/sessions`)).json();
  const open = await bookableFor(request, lane.user, lane.day);
  const steps = open.filter((s) => s.room.accessible === false);
  const held = steps.at(-1);
  // The recommendation list shows the first 8 matches, soonest first: pick the topic that ranks a
  // non-accessible session highest, so it is among them.
  const topicsOf = (s) => s.tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  const order = (a, b) => a.day.localeCompare(b.day) || a.startsAt.localeCompare(b.startsAt) || a.id - b.id;
  const rankIn = (topic, session) => all.filter((s) => topicsOf(s).includes(topic) && order(s, session) < 0).length;
  const picks = steps
    .filter((s) => s.id !== held.id && !(s.startsAt < held.endsAt && held.startsAt < s.endsAt))
    .flatMap((s) => topicsOf(s).map((topic) => ({ rec: s, topic, rank: rankIn(topic, s) })))
    .sort((a, b) => a.rank - b.rank);
  expect(picks[0], 'a non-accessible session that does not clash').toBeTruthy();
  expect(picks[0].rank, 'ranks among the first 8 recommendations').toBeLessThan(8);
  const { rec, topic } = picks[0];

  try {
    await put(lane.user, []);
    await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: [topic] } });
    const res = await request.put(`${API}/users/${lane.user}/reservations/${held.id}`, { data: now });
    expect(res.ok()).toBe(true);

    // Profile: three options, select, reload, clear.
    await visit(page, '/profile', { as: lane.user, at });
    const needs = page.getByTestId('profile-access-needs').getByTestId('access-need');
    await expect(needs).toHaveCount(3);
    for (const n of await needs.all()) await expect(n).toHaveAttribute('aria-pressed', 'false');
    await needs.first().click();
    await expect(needs.first()).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(needs.first()).toHaveAttribute('aria-pressed', 'true');
    await expect(needs.nth(1)).toHaveAttribute('aria-pressed', 'false');
    await visit(page, '/profile', { as: other, at });
    await expect(needs.first()).toHaveAttribute('aria-pressed', 'false');
    await visit(page, '/profile', { as: lane.user, at });
    await shotForPR(page, 'Accessibility needs on My Profile');

    // Step-free set: the flag shows on all three places.
    const flagged = async () => {
      await visit(page, `/sessions/${held.id}`, { as: lane.user, at });
      await expect(page.getByRole('heading', { name: held.title })).toBeVisible();
      await visit(page, '/my-agenda', { as: lane.user, at });
      const row = page.getByTestId('agenda-session').filter({ hasText: held.title });
      const recRow = page.getByTestId('recommendation').filter({ hasText: rec.title });
      await expect(row).toBeVisible();
      await expect(recRow).toBeVisible();
      return { row, recRow };
    };
    let f = await flagged();
    await expect(f.row.getByTestId('not-step-free')).toBeVisible();
    await expect(f.recRow.getByTestId('not-step-free')).toBeVisible();
    await shotForPR(page, 'Not step-free flags on My Agenda');
    await visit(page, `/sessions/${held.id}`, { as: lane.user, at });
    await expect(page.getByTestId('not-step-free')).toBeVisible();

    // Cleared: no flag anywhere.
    await put(lane.user, ['hearing', 'quiet']);
    await visit(page, `/sessions/${held.id}`, { as: lane.user, at });
    await expect(page.getByRole('heading', { name: held.title })).toBeVisible();
    await expect(page.getByTestId('not-step-free')).toHaveCount(0);
    f = await flagged();
    await expect(f.row.getByTestId('not-step-free')).toHaveCount(0);
    await expect(f.recRow.getByTestId('not-step-free')).toHaveCount(0);
    await expect(page.getByTestId('not-step-free')).toHaveCount(0);
  } finally {
    await request.delete(`${API}/users/${lane.user}/reservations/${held.id}`);
    await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: originalInterests } });
    await put(lane.user, originalNeeds);
  }
});
