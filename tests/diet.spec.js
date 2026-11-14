import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, shotForPR } from './helpers.js';

// One walk: pick a diet on My Profile (persists, per attendee), then the Food page applies it,
// a URL value wins, "Any dietary" clears it for good, and with no diet Food is unfiltered.
test('a dietary requirement on My Profile becomes the Food page filter', async ({ page, request }, testInfo) => {
  const lane = await laneFor('diet.profile', testInfo);
  const at = await momentOn(0, '10:30');
  const other = 3; // an attendee this test never writes
  const put = (diet) => request.put(`${API}/users/${lane.user}/diet`, { data: { diet } });
  const original = (await (await request.get(`${API}/users/${lane.user}`)).json()).diet;
  const vendors = async (q = '') => (await (await request.get(`${API}/vendors${q}`)).json());
  const total = (await vendors()).length;
  const glutenFree = (await vendors('?dietary=gluten-free')).length;
  const vegetarian = (await vendors('?dietary=vegetarian')).length;
  expect(glutenFree).toBeLessThan(total);
  expect(vegetarian).not.toBe(glutenFree);

  const select = page.getByTestId('food-filters').getByLabel('Dietary');
  const count = page.getByTestId('vendor-count');

  try {
    await put(null);

    // No diet set: Food is as it always was.
    await visit(page, '/food', { as: lane.user, at });
    await expect(select).toHaveValue('all');
    await expect(count).toHaveText(`${total} vendors`);

    // Profile: three options, select, reload, per attendee.
    await visit(page, '/profile', { as: lane.user, at });
    const options = page.getByTestId('profile-diet').getByTestId('diet-option');
    await expect(options).toHaveCount(3);
    for (const o of await options.all()) await expect(o).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('profile-diet').getByRole('button', { name: /gluten/i }).click();
    const gf = page.getByTestId('profile-diet').getByRole('button', { name: /gluten/i });
    await expect(gf).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(gf).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('profile-diet').locator('[aria-pressed="true"]')).toHaveCount(1);
    await shotForPR(page, 'Dietary requirements on My Profile');
    await visit(page, '/profile', { as: other, at });
    await expect(page.getByTestId('profile-diet').locator('[aria-pressed="true"]')).toHaveCount(0);

    // Food applies the saved diet; a URL value wins.
    await visit(page, '/food', { as: lane.user, at });
    await expect(select).toHaveValue('gluten-free');
    await expect(count).toHaveText(`${glutenFree} vendors`);
    await shotForPR(page, 'Food page filtered by the profile diet');
    await visit(page, '/food?dietary=vegetarian', { as: lane.user, at });
    await expect(select).toHaveValue('vegetarian');
    await expect(count).toHaveText(`${vegetarian} vendors`);

    // Clearing sticks, through a reload.
    await visit(page, '/food', { as: lane.user, at });
    await expect(select).toHaveValue('gluten-free');
    await select.selectOption('all');
    await expect(select).toHaveValue('all');
    await expect(count).toHaveText(`${total} vendors`);
    await expect(page).toHaveURL(/dietary=all/);
    await page.reload();
    await expect(select).toHaveValue('all');
    await expect(count).toHaveText(`${total} vendors`);
  } finally {
    await put(original);
  }
});
