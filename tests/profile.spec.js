import { test, expect } from '@playwright/test';
import { visit, shotForPR, failOnPageErrors, ATTENDEES, API } from './helpers.js';

// Read-only: nothing is booked, so no data lane is needed.
test.describe('My Profile', () => {
  test('the Profile tab opens the signed-in attendee, and switching updates it without a reload', async ({ page, request }, testInfo) => {
    const errors = failOnPageErrors(page);
    const jonas = await (await request.get(`${API}/users/${ATTENDEES.jonas}`)).json();
    const andy = await (await request.get(`${API}/users/${ATTENDEES.andy}`)).json();

    await visit(page, '/', { as: ATTENDEES.jonas });
    const mobile = testInfo.project.name.includes('mobile');
    if (mobile) await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('navigation', { name: mobile ? 'Mobile' : 'Main' }).getByRole('link', { name: /Profile/ }).click();

    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    const show = async (u) => {
      await expect(page.getByTestId('profile-name')).toHaveText(u.name);
      await expect(page.getByTestId('profile-pronouns')).toHaveText(u.pronouns);
      await expect(page.getByTestId('profile-job-title')).toHaveText(u.jobTitle);
      await expect(page.getByTestId('profile-company')).toHaveText(u.company);
      await expect(page.getByTestId('profile-bio')).toHaveText(u.bio);
      await expect(page.getByTestId('profile-email')).toHaveText(u.email);
    };
    await show(jonas);
    await shotForPR(page, 'My Profile showing the signed-in attendee');

    // Switch attendee: same document, new details.
    await page.evaluate(() => { window.__noReload = true; });
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await page.getByRole('option', { name: /Andy/ }).click();
    await show(andy);
    expect(await page.evaluate(() => window.__noReload)).toBe(true);
    await expect(page).toHaveURL(/\/profile$/);
    expect(errors).toEqual([]);
  });
});
