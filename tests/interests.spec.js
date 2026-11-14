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

// The dev server has no model, so the describe request is fulfilled in the browser
// after a real PUT: this proves the page path, the API tests prove the route.
test('describe interests on Home: lands on My Profile with the note, stays editable, 503 stays put', async ({ page, request }, testInfo) => {
  const mobile = testInfo.project.name.toLowerCase().includes('mobile');
  const me = mobile ? ATTENDEES.marcus : ATTENDEES.kenji;
  const original = (await (await request.get(`${API}/users/${me}`)).json()).interests;
  const topics = (await (await request.get(`${API}/bootstrap`)).json()).tags.filter((t) => t.kind === 'topic').map((t) => t.name);
  const picked = [topics[0], topics[1]];

  try {
    await visit(page, '/', { as: me });
    await page.getByTestId('describe-interests-open').click();
    await expect(page.getByTestId('describe-interests-submit')).toBeDisabled();

    // No key: the entry explains and stays on Home.
    await page.route(`**/api/users/${me}/interests/describe`, (route) =>
      route.fulfill({ status: 503, json: { error: 'Describing your interests is unavailable right now.' } }));
    await page.getByTestId('describe-interests-text').fill('machine learning');
    await page.getByTestId('describe-interests-submit').click();
    await expect(page.getByTestId('describe-interests-error')).toContainText('unavailable');
    await expect(page).toHaveURL(/\/$/);

    // With a model: the chips come back pressed, with the note.
    await page.unroute(`**/api/users/${me}/interests/describe`);
    await page.route(`**/api/users/${me}/interests/describe`, async (route) => {
      const res = await request.put(`${API}/users/${me}/interests`, { data: { interests: picked } });
      await route.fulfill({ status: 200, json: await res.json() });
    });
    await page.getByTestId('describe-interests-submit').click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId('interests-note')).toBeVisible();
    const chips = page.getByTestId('interest-chip');
    for (const name of picked) await expect(chips.filter({ hasText: new RegExp(`^${name}$`) })).toHaveAttribute('aria-pressed', 'true');
    await shotForPR(page, 'My Profile after describing interests');

    await chips.filter({ hasText: new RegExp(`^${picked[0]}$`) }).click();
    await expect(chips.filter({ hasText: new RegExp(`^${picked[0]}$`) })).toHaveAttribute('aria-pressed', 'false');
  } finally {
    await request.put(`${API}/users/${me}/interests`, { data: { interests: original } });
  }
});
