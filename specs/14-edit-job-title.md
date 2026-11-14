# Let attendees edit their job title on My Profile

## What this changes
The Job title row on My Profile becomes a text field with a Save button, shown even when the title is empty. Saving stores it for that attendee; it survives a reload and shows in the attendee switcher straight away (no reload) and on their session reviews. Saving an empty (or all-space) title clears it. A title over 100 characters is refused with a message and nothing changes. Pronouns, company, email and bio stay read-only.

## Where
- `server/routes/users.js` — add `saveJobTitle = UPDATE users SET job_title = ? WHERE id = ?`, `MAX_TITLE = 100`, and `PUT /:id/job-title` beside `/level`: 404 unknown attendee; body `{ jobTitle }` must be a string or null, else 400; trim it; length > 100 is 400; empty becomes NULL; reply `{ jobTitle }` read back through `toUser`. Test in `tests/api/job-title.test.js` using `startApi()` (pattern of `tests/api/diet.test.js`).
- `server/lib/query.js` — `toUser`: `jobTitle: row.job_title || null`, so a cleared title is `null`, never `''`.
- `src/lib/api.js` — `putJobTitle(userId, jobTitle)`, next to `putDiet`.
- `src/lib/store.jsx` — expose `patchUser(id, patch)` from `useConference()`, which updates that entry in `data.users` so the switcher and `currentUser` follow a save (the store is the source of truth for the signed-in attendee).
- `src/pages/ProfilePage.jsx` — drop `job-title` from the filtered `rows`; add a `JobTitle` section/row inside the details card with `data-testid="profile-job-title-input"`, `profile-job-title-save`; on Save call `api.putJobTitle`, then `patchUser`; a failed save toasts the server message and keeps the typed text. Resets on attendee switch like the other sections (`userId` effect). `maxLength` is not set on the input, so the server's 400 is reachable and shown.
- `tests/helpers.js` — new lane `profile.job-title`: desktop `sofia`, mobile `marcus`, `readOnly: true` (neither is read for a job title by `tests/profile.spec.js`, which uses Jonas and Andy). Spec in `tests/job-title.spec.js` using `laneFor`, `visit`, `shotForPR`; it restores the original title in `finally`.
- Docs: `context/engineering-context/ui.md` (Profile paragraph) and `seats.md` (the `/api/users` route list) gain the job-title field and route; `data-model.md` notes `job_title` is user-editable and `''` maps to `null`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Edit and save the title on My Profile | Type a new title, click Save, input shows it and the profile row reads it | Playwright `tests/job-title.spec.js` |
| Persists across reloads | After Save, `page.reload()` shows the new title; the API read returns it; another attendee's title is unchanged | Playwright spec; API test "belongs to that attendee only" |
| Shows wherever the title appears | Attendee switcher option for that attendee shows the new title without a reload | Playwright spec |
| Empty title clears it | `PUT {jobTitle: ''}` and `{jobTitle: null}` and `'   '` give 200 `{ jobTitle: null }` and a read returns `null`; in the UI, clearing the field and Save leaves it empty after reload | API test; Playwright spec |
| Over 100 characters rejected | 101 chars is 400 and the old title stays; exactly 100 is accepted; a number or missing body is 400; unknown attendee 404; UI shows the error toast and keeps the old saved title | API test; Playwright spec |
| API tests cover updating and clearing | `tests/api/job-title.test.js` (update, trim, clear, reject, 404, isolation) | API |

## Decisions
- Use an explicit Save button for the title (typing is not saved per keystroke), unlike the one-click chips — OK?
- Trim surrounding spaces before saving and before the 100-character check, and treat an all-space title as empty — OK?
- A cleared title is stored as NULL and read as `null`; the Job title row stays visible (empty field) on My Profile so it can be filled in again — OK?
- Only the signed-in attendee's own title is editable in the UI; the route, like the other profile routes, has no auth and takes any `:id` — OK?

## Out of scope
Editing pronouns, company, email, bio or any other registration detail; speaker profiles' job titles.
