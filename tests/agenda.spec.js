import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, bookableFor, shotForPR, failOnPageErrors } from './helpers.js';

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
});
