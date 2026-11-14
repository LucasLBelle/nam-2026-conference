import { test, expect } from '@playwright/test';
import { ATTENDEES, API, visit, shotForPR } from './helpers.js';

// Desktop writes Kenji, mobile writes Marcus, so the two projects never share an attendee.
test('pick topic interests on My Profile: select, deselect, reload, per attendee', async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name.toLowerCase().includes('mobile');
  const me = mobile ? ATTENDEES.marcus : ATTENDEES.kenji;
  const other = ATTENDEES.sofia; // neither project writes her
  const original = (await (await request.get(`${API}/users/${me}`)).json()).interests;
  const otherSeeded = (await (await request.get(`${API}/users/${other}`)).json()).interests;
  const tags = (await (await request.get(`${API}/bootstrap`)).json()).tags;
  const topics = tags.filter((t) => t.kind === 'topic').map((t) => t.name);

  try {
    await request.put(`${API}/users/${me}/interests`, { data: { interests: [] } });
    await visit(page, '/profile', { as: me });
    const box = page.getByTestId('profile-interests');
    const chips = box.getByTestId('interest-chip');
    await expect(chips).toHaveCount(topics.length);
    expect(await chips.allTextContents()).toEqual(topics);
    const chip = chips.first();
    await expect(chip).toHaveAttribute('aria-pressed', 'false');

    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await shotForPR(page, 'Interests chips on My Profile');

    await page.reload();
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');

    await chips.first().click();
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'false');
    await chips.first().click();
    await expect(chips.first()).toHaveAttribute('aria-pressed', 'true');

    // Another attendee shows their own seeded interests, not this pick.
    await visit(page, '/profile', { as: other });
    await expect(page.getByTestId('interest-chip').first()).toBeVisible();
    const pressed = await page.locator('[data-testid=interest-chip][aria-pressed=true]').allTextContents();
    expect(pressed.sort()).toEqual([...otherSeeded].sort());
  } finally {
    await request.put(`${API}/users/${me}/interests`, { data: { interests: original } });
  }
});
