import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, conferenceDays, shotForPR, failOnPageErrors } from './helpers.js';

test.describe('My Agenda', () => {
  test('lists seats and waitlist places, totals booked time apart, removes without a reload, and says when empty', async ({ page, request }, testInfo) => {
    const errors = failOnPageErrors(page);
    const lane = await laneFor('agenda.page', testInfo);
    const at = await momentOn(0, '07:00');
    const now = { day: at.slice(0, 10), time: '07:00' };

    const open = await bookableFor(request, lane.user, lane.day);
    const full = open.find((s) => s.isFull);
    expect(full, 'no full session to queue for').toBeTruthy();
    const seat = open.find((s) => !s.isFull && !(s.startsAt < full.endsAt && full.startsAt < s.endsAt));
    expect(seat, 'no free session clear of the full one').toBeTruthy();
    const booked = [seat, full];
    try {
      for (const s of booked) {
        const res = await request.put(`${API}/users/${lane.user}/reservations/${s.id}`, { data: now });
        expect(res.ok()).toBe(true);
      }

      await visit(page, '/my-agenda', { as: lane.user, at });
      await expect(page.getByTestId('agenda-empty')).toHaveCount(0);
      await expect(page.getByTestId('agenda-coming-soon')).toHaveCount(0);

      // Both rows sit under the lane's day, in time order, and only the queued one is marked.
      const dayLabel = page.getByTestId('agenda-day').filter({ has: page.getByText(seat.title, { exact: true }) });
      const rows = dayLabel.getByTestId('agenda-session');
      const expectedOrder = [...booked].sort((a, b) => a.startsAt.localeCompare(b.startsAt)).map((s) => s.title);
      await expect(rows.filter({ hasText: expectedOrder[0] })).toHaveCount(1);
      await expect(rows.filter({ hasText: expectedOrder[1] })).toHaveCount(1);
      const titles = await rows.allInnerTexts();
      const pos = (title) => titles.findIndex((t) => t.includes(title));
      expect(pos(expectedOrder[0])).toBeLessThan(pos(expectedOrder[1]));
      const queuedRow = rows.filter({ hasText: full.title });
      await expect(queuedRow.getByTestId('agenda-waitlisted')).toBeVisible();
      await expect(rows.filter({ hasText: seat.title }).getByTestId('agenda-waitlisted')).toHaveCount(0);
      await expect(page.getByTestId('agenda-waitlisted-time')).toContainText('waitlisted');
      await expect(page.getByTestId('agenda-booked')).toBeVisible();
      await shotForPR(page, 'My Agenda with a seat and a waitlist place');

      // Remove the seat: it leaves without a reload and the seat is released.
      await page.evaluate(() => { window.__noReload = true; });
      const before = await page.getByTestId('agenda-session').count();
      await rows.filter({ hasText: seat.title }).getByTestId('agenda-remove').click();
      await expect(page.getByTestId('agenda-session')).toHaveCount(before - 1);
      await expect(page.getByText(seat.title, { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => window.__noReload)).toBe(true);
      const plan = await (await request.get(`${API}/users/${lane.user}/schedule`)).json();
      const held = plan.days.flatMap((d) => d.sessions).map((s) => s.id);
      expect(held).not.toContain(seat.id);

      // Nothing held: an empty state that links to the Schedule.
      await page.route('**/api/users/*/schedule', (route) => route.fulfill({ json: { user: {}, days: [] } }));
      await visit(page, '/my-agenda', { as: lane.user, at });
      await expect(page.getByTestId('agenda-empty')).toBeVisible();
      await expect(page.getByTestId('agenda-empty').getByRole('link', { name: /schedule/i })).toHaveAttribute('href', '/schedule');
      expect(errors).toEqual([]);
    } finally {
      for (const s of booked) await request.delete(`${API}/users/${lane.user}/reservations/${s.id}`);
    }
  });

  test('recommends upcoming sessions from interests: skips ended and held, adds without a reload, offers Keep / Swap on a clash, prompts with no interests', async ({ page, request }, testInfo) => {
    const errors = failOnPageErrors(page);
    const lane = await laneFor('agenda.recommend', testInfo);
    const dayIndex = (await conferenceDays()).indexOf(lane.day);
    const at = await momentOn(dayIndex, '07:00');
    const now = { day: lane.day, time: '07:00' };
    const topicsOf = (s) => s.tags.filter((t) => t.kind === 'topic').map((t) => t.name);
    const overlaps = (a, b) => a.startsAt < b.endsAt && b.startsAt < a.endsAt;

    const all = await (await request.get(`${API}/sessions`)).json();
    const open = (await bookableFor(request, lane.user, lane.day)).filter((s) => !s.isFull);
    // Two clashing sessions on the lane's day that share a topic: the first is added, the second clashes with it.
    const me = await (await request.get(`${API}/users/${lane.user}`)).json();
    const held = new Set(me.reservations.map((r) => r.sessionId));
    const days = await conferenceDays();
    // A Day 1 morning session on a topic, already over by 15:00, that this attendee does not hold.
    const endedOn = (topic) => all
      .filter((s) => s.day === days[0] && s.endsAt <= '12:15' && topicsOf(s).includes(topic) && !held.has(s.id))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id)[0];
    let first, second, topic, over;
    for (const a of open) for (const b of open) {
      if (first || a.id === b.id || !overlaps(a, b)) continue;
      const shared = topicsOf(a).find((n) => topicsOf(b).includes(n) && endedOn(n));
      if (shared) [first, second, topic, over] = [a, b, shared, endedOn(shared)];
    }
    expect(first, 'no clashing pair sharing a topic that also has an ended Day 1 session').toBeTruthy();

    const original = me.interests;
    const setInterests = (interests) => request.put(`${API}/users/${lane.user}/interests`, { data: { interests } });
    try {
      expect((await setInterests([topic])).ok()).toBe(true);

      // Before it ends (Day 1, 07:00) the early session is recommended; by 15:00 it is gone.
      await visit(page, '/my-agenda', { as: lane.user, at: await momentOn(0, '07:00') });
      const section = page.getByTestId('agenda-recommendations');
      const recs = section.getByTestId('recommendation');
      await expect(recs.filter({ hasText: over.title })).toHaveCount(1);
      await visit(page, '/my-agenda', { as: lane.user, at: await momentOn(0, '15:00') });
      await expect(recs.first()).toBeVisible();
      await expect(recs.filter({ hasText: over.title })).toHaveCount(0);

      // On the lane's day: every row is tagged with the interest and none is on the agenda.
      await visit(page, '/my-agenda', { as: lane.user, at });
      await expect(recs.filter({ hasText: first.title })).toHaveCount(1);
      for (const title of await recs.locator('a').allInnerTexts()) {
        const s = all.find((x) => x.title === title);
        expect(topicsOf(s)).toContain(topic);
        await expect(page.getByTestId('agenda-session').filter({ hasText: title })).toHaveCount(0);
      }
      await shotForPR(page, 'My Agenda recommendations from interests');

      // Add: it leaves the recommendations and joins the agenda, no reload.
      await page.evaluate(() => { window.__noReload = true; });
      await recs.filter({ hasText: first.title }).getByTestId('recommendation-add').getByRole('button').click();
      await expect(page.getByTestId('agenda-session').filter({ hasText: first.title })).toHaveCount(1);
      await expect(recs.filter({ hasText: first.title })).toHaveCount(0);
      expect(await page.evaluate(() => window.__noReload)).toBe(true);
      const plan = await (await request.get(`${API}/users/${lane.user}/schedule`)).json();
      expect(plan.days.flatMap((d) => d.sessions).map((s) => s.id)).toContain(first.id);

      // A clash opens Keep / Swap; Keep leaves the agenda as it was.
      await recs.filter({ hasText: second.title }).getByTestId('recommendation-add').getByRole('button').click();
      const dialog = page.getByTestId('conflict-dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByTestId('conflict-keep').click();
      await expect(dialog).toHaveCount(0);
      await expect(page.getByTestId('agenda-session').filter({ hasText: second.title })).toHaveCount(0);

      // No interests: a prompt linking to My Profile, no rows.
      expect((await setInterests([])).ok()).toBe(true);
      await visit(page, '/my-agenda', { as: lane.user, at });
      await expect(page.getByTestId('recommendations-set-interests')).toHaveAttribute('href', '/profile');
      await expect(recs).toHaveCount(0);
      // the clash's 409 is the point of this test, not an error
      expect(errors.filter((e) => !e.includes('409'))).toEqual([]);
    } finally {
      await request.delete(`${API}/users/${lane.user}/reservations/${first.id}`);
      await request.delete(`${API}/users/${lane.user}/reservations/${second.id}`);
      await setInterests(original);
    }
  });
});
