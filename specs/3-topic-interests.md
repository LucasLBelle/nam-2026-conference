# Let attendees pick their topic interests on My Profile

## What this changes
My Profile gains an "Interests" section listing every topic tag (the 35 tags of kind `topic`) as a toggle chip. The attendee clicks a chip to select or deselect it; each click saves at once. Selections survive a reload and belong to the signed-in attendee, so switching attendee shows theirs. The API gains `PUT /api/users/:id/interests`, which replaces the list and rejects anything that is not a topic tag.

## Where
- `server/routes/users.js` — add `usersRouter.put('/:id/interests', …)` beside the follows routes, and a prepared `UPDATE users SET interests = ? WHERE id = ?`. 404 `Attendee not found` via `userExists`; body `{ interests: string[] }`, otherwise 400. Every name must be a `topic` tag (`SELECT name FROM tags WHERE kind = 'topic'`, as `seed.test.js` assumes), else 400 `unknown topic: <name>`; duplicates are dropped. Store comma-joined, which is safe because no topic name contains a comma. Reply `{ interests }`, read back through `toUser` so the list format stays the mapper's. `GET /users/:id` already returns `interests`, so nothing changes there.
- `src/lib/api.js` — add `putInterests(userId, interests)` next to `followSpeaker`; the only caller of `fetch`.
- `src/pages/ProfilePage.jsx` — an Interests section under the details card. Topics come from `useConference().tags` filtered to `kind === 'topic'`; the selected set comes from `user.interests` (the page's own `useFetch(getUser)`). A chip is a `<button aria-pressed>` with `data-testid="interest-chip"`, inside `data-testid="profile-interests"`. A click calls `api.putInterests`, then sets local state from the response; on failure it shows the existing error toast and keeps the old selection. Local state resets when `id` changes, so the switcher shows the other attendee's list without a reload.
- `tests/api/interests.test.js` (new) — `startApi()` from `tests/api/harness.js`, its own throwaway database, so no lane. Attendee 3 (Kenji).
- `tests/api/endpoints.test.js` — add `'PUT users/:id/interests'` to `covered`, and the 404 case for `/users/999999/interests` beside the other unknown-attendee cases.
- `tests/interests.spec.js` (new) — `visit(page, '/profile', { as })` from `tests/helpers.js`. It writes only interests and books nothing, so it takes no `LANES` entry. Desktop uses Kenji and mobile uses Marcus (chosen by `testInfo.project.name`), so the two projects never write the same attendee, and the test puts the original interests back through the API at the end.
- `context/engineering-context/ui.md` and `architecture.md` — one line each for the Interests section and the new route (`node scripts/context.mjs for …`).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| My Profile lists the topic tags; select and deselect | `interests.spec.js`: `profile-interests` holds one chip per topic tag and none of the tech/audience/vibe tags; clicking an unselected chip sets `aria-pressed=true`, clicking it again sets it false | browser spec |
| Selections persist across reloads | `interests.spec.js`: select a topic, `page.reload()`, chip is still pressed; `interests.test.js`: `PUT` then `GET /users/3` returns the new list | browser spec + API |
| Belong to that attendee only | `interests.test.js`: after `PUT /users/3/interests`, `GET /users/5` is unchanged; `interests.spec.js`: switch attendee via the switcher, the pressed chips are the other attendee's seeded interests, not the new pick | API + browser spec |
| API tests cover reading and updating, and an unknown tag is rejected | `interests.test.js`: `PUT` returns the saved list (200); an unknown name and a real non-topic tag (`Python`) each give 400 and leave the list unchanged; a non-array body gives 400; unknown attendee gives 404; an empty list clears | API |

## Decisions
The reading half of the third criterion already holds on main: `GET /api/users/:id` returns `interests` (seeded, and covered by `toUser` in `tests/unit/query.test.js`). This build proves the update and rejection paths, and checks reads only as the read-back after a write. Nothing on main can change interests, so the rest of the ticket is new.
- "Topic tags" means tags of kind `topic` only, not tech, audience or vibe: yes? (`seed.test.js` already requires every seeded interest to be one.)
- Each click saves immediately, with no Save button: yes?
- `PUT` replaces the whole list, and an unknown or non-topic name rejects the whole request (400) rather than being skipped: yes?
- The bootstrap `users` list is left stale after a save; the profile reads `GET /users/:id` itself, and nothing else shows interests yet: yes?

## Out of scope
Using interests to suggest sessions, show them on Home or My Agenda, or filter the schedule by them.
