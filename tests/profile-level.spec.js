import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, shotForPR } from './helpers.js';

// One walk: choose a highest level on My Profile (it persists across a reload, and clicking it again clears it),
// then My Agenda lists a session above that level after the one at or below it, though it starts earlier.
// The clock is pinned before Day 1's first slot.
test('highest session level on My Profile reorders My Agenda recommendations', async ({ page, request }, testInfo) => {
  const lane = await laneFor('profile.level', testInfo);
  const at = await momentOn(0, '07:00');
  const original = await (await request.get(`${API}/users/${lane.user}`)).json();
  const sessions = await (await request.get(`${API}/sessions`)).json();
  const held = new Set(original.reservations.map((r) => r.sessionId));
  const byTopic = (topic) => sessions
    .filter((s) => s.day === lane.day && !held.has(s.id) && s.tags.some((t) => t.kind === 'topic' && t.name === topic))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id - b.id)
    .slice(0, 8); // the page shows the first eight
  // One topic where an Advanced session starts before a Beginner one, both among the first eight.
  let pair = null;
  let topic = null;
  for (const t of new Set(sessions.flatMap((s) => s.tags.filter((x) => x.kind === 'topic').map((x) => x.name)))) {
    const list = byTopic(t);
    const hard = list.find((s) => s.level === 'Advanced');
    const easy = hard && list.find((s) => s.level === 'Beginner' && (s.startsAt > hard.startsAt || (s.startsAt === hard.startsAt && s.id > hard.id)));
    if (easy) { pair = { hard, easy }; topic = t; break; }
  }
  expect(pair, 'a topic with an Advanced session before a Beginner one on the lane day').not.toBeNull();
  const { hard, easy } = pair;
  const titles = () => page.getByTestId('recommendation').evaluateAll((els) => els.map((e) => e.textContent));
  const indexOf = async (s) => (await titles()).findIndex((t) => t.includes(s.title));

  try {
    await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: [topic] } });

    // No maximum: soonest first, the Advanced session ahead.
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(page.getByTestId('recommendation').filter({ hasText: easy.title })).toBeVisible();
    expect(await indexOf(hard)).toBeLessThan(await indexOf(easy));

    // Profile: Beginner is chosen, survives a reload, and shows as pressed.
    await visit(page, '/profile', { as: lane.user, at });
    const box = page.getByTestId('profile-level');
    await box.getByTestId('level-option').filter({ hasText: 'Beginner' }).click();
    await page.reload();
    await expect(box.getByRole('button', { name: 'Beginner' })).toHaveAttribute('aria-pressed', 'true');
    await expect(box.getByRole('button', { name: 'Advanced' })).toHaveAttribute('aria-pressed', 'false');
    await shotForPR(page, 'Highest session level on My Profile');

    // My Agenda: the Advanced session is still listed, but after the Beginner one.
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(page.getByTestId('recommendation').filter({ hasText: hard.title })).toBeVisible();
    expect(await indexOf(easy)).toBeLessThan(await indexOf(hard));
    await shotForPR(page, 'Recommendations above the chosen level listed last');

    // Click it again: cleared, and the order is back to soonest first.
    await visit(page, '/profile', { as: lane.user, at });
    await box.getByRole('button', { name: 'Beginner' }).click();
    await expect(box.getByRole('button', { name: 'Beginner' })).toHaveAttribute('aria-pressed', 'false');
    await visit(page, '/my-agenda', { as: lane.user, at });
    await expect(page.getByTestId('recommendation').filter({ hasText: easy.title })).toBeVisible();
    expect(await indexOf(hard)).toBeLessThan(await indexOf(easy));
  } finally {
    await request.put(`${API}/users/${lane.user}/level`, { data: { level: null } });
    await request.put(`${API}/users/${lane.user}/interests`, { data: { interests: original.interests } });
  }
});
