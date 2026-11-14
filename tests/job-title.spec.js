import { test, expect } from '@playwright/test';
import { API, visit, momentOn, laneFor, shotForPR } from './helpers.js';

// One walk: edit the job title on My Profile, see it in the attendee switcher without a reload,
// keep it across a reload, be refused over 100 characters, and clear it with an empty field.
// The original title is restored at the end. The clock is pinned though nothing here depends on it.
test('job title on My Profile saves, persists, rejects over 100 characters and clears', async ({ page, request }, testInfo) => {
  const lane = await laneFor('profile.job-title', testInfo);
  const at = await momentOn(0, '09:00');
  const original = await (await request.get(`${API}/users/${lane.user}`)).json();
  const input = page.getByTestId('profile-job-title-input');
  const save = page.getByTestId('profile-job-title-save');
  const NEW = 'Principal Rocket Surgeon';

  try {
    await visit(page, '/profile', { as: lane.user, at });
    await expect(input).toHaveValue(original.jobTitle);

    // Save: the row reads it, and the switcher shows it with no reload.
    await input.fill(NEW);
    await save.click();
    await expect(page.getByTestId('profile-job-title')).toHaveText(NEW);
    await page.getByRole('button', { name: /Switch attendee/ }).click();
    await expect(page.getByRole('option', { name: new RegExp(original.name) })).toContainText(NEW);
    await page.keyboard.press('Escape');
    await shotForPR(page, 'My Profile with an editable job title');

    // Persists across a reload.
    await page.reload();
    await expect(input).toHaveValue(NEW);

    // Over 100 characters: refused with the server's message, typed text kept, saved title unchanged.
    await input.fill('x'.repeat(101));
    await save.click();
    await expect(page.getByText(/100 characters or fewer/)).toBeVisible();
    await expect(input).toHaveValue('x'.repeat(101));
    await expect(page.getByTestId('profile-job-title')).toHaveText(NEW);

    // Empty clears it, and stays cleared after a reload.
    await input.fill('');
    await save.click();
    await expect(page.getByTestId('profile-job-title')).toHaveText('');
    await page.reload();
    await expect(input).toHaveValue('');
  } finally {
    await request.put(`${API}/users/${lane.user}/job-title`, { data: { jobTitle: original.jobTitle } });
  }
});
