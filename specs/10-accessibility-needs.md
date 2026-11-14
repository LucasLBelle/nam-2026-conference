# Let attendees record accessibility needs on My Profile

## What this changes
My Profile gets an "Accessibility needs" card with three toggles (step-free / wheelchair access, hearing loop or captions, quiet space). Each click saves the whole set for that attendee, and it survives a reload. When step-free is set, a session in a room that is not accessible carries a "Not step-free" flag on its session page, in the My Agenda list and in My Agenda's recommendations. With step-free unset, no flag appears anywhere.

## Where
- `server/db.js` — add `access_needs TEXT NOT NULL DEFAULT ''` to the `users` table (after `interests`); `dropAll` + reseed already rebuilds it, `seed.js` needs no change.
- `server/lib/query.js` — `toUser`: add `accessNeeds: row.access_needs ? row.access_needs.split(',').filter(Boolean) : []`, beside `interests`.
- `server/routes/users.js` — `ACCESS_NEEDS = ['step-free', 'hearing', 'quiet']`, a `saveAccessNeeds` statement, and `PUT /:id/access-needs` modelled on `/:id/interests` (404 unknown attendee, 400 for a non-list or any option outside the three, de-duplicated, replies `{ accessNeeds }`).
- `src/lib/api.js` — `putAccessNeeds(userId, accessNeeds)`, the only caller of `fetch`.
- `src/pages/ProfilePage.jsx` — new `AccessNeeds` section beside `Interests` (`data-testid="profile-access-needs"`, buttons `access-need` with `aria-pressed`, labels in a const list); pass `user.accessNeeds`.
- `src/components/ui.jsx` — a small `NotStepFree` flag (`data-testid="not-step-free"`) so the three places share one look; wording "Not step-free".
- `src/pages/SessionPage.jsx` — the sidebar note at ~line 294 (`!session.room.accessible`) is unconditional today; fetch the attendee with `api.getUser(currentUserId)` (the store copy goes stale after a Profile save) and show it only when `accessNeeds` includes `step-free`; keep the "See step-free alternatives" link.
- `src/pages/MyAgendaPage.jsx` — it already fetches `me`; render `NotStepFree` on each `agenda-session` and `recommendation` row when `me.data.accessNeeds` includes `step-free` and `!s.room.accessible` (schedule and `/sessions` payloads carry `room.accessible`).
- Tests: `tests/api/access-needs.test.js` (throwaway DB via `startApi()` from `tests/api/harness.js`, attendees Kenji 3 and Marcus 5, as `interests.test.js`); `tests/access-needs.spec.js` (Playwright, same lane pattern as `tests/interests.spec.js`: desktop writes `ATTENDEES.kenji`, mobile `ATTENDEES.marcus`, restores in `finally`; `visit`, `API`, `conferenceDays`, `bookableFor`, `clearAgendaFor` from `tests/helpers.js`; clock pinned with `visit(..., { at })`). The spec finds a non-accessible session via `GET /sessions` (`room.accessible === false`), books it for the lane attendee on a day it releases afterwards, and uses an interest from `PUT /users/:id/interests` so a recommendation for it exists.
- Docs: update `context/engineering-context/agenda.md` and `data-model.md` (new column, route, flag).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Needs save, read back, clear, per attendee | `access-needs.test.js`: PUT `['step-free','quiet']` replies and `GET /users/3` returns it; `GET /users/5` unchanged; PUT `[]` clears | API |
| Unknown option rejected | `access-needs.test.js`: PUT `['jetpack']` is 400 and the saved list is unchanged; non-list is 400 | API |
| Profile lists three, select, clear, persist | `access-needs.spec.js`: three `access-need` buttons, click sets `aria-pressed`, survives reload, click clears; another attendee unaffected | Playwright |
| Flag with step-free set: session page, agenda list, recommendations | `access-needs.spec.js`: with step-free set, `not-step-free` is visible on the non-accessible session page, on its `agenda-session` row and on its `recommendation` row | Playwright |
| No flag without step-free | `access-needs.spec.js`: with the need cleared, `not-step-free` count is 0 on all three (false on main for the session page) | Playwright |

## Decisions
- The session page already shows "Not step-free" for every non-accessible room, whatever the attendee set, so "flag on its session page" holds today and "no flag without step-free" is false there. This build gates that existing note on the attendee's step-free need, so it disappears for everyone else, rather than leaving it always on. Is that reading OK?
- The needs are stored as a comma-separated `users.access_needs` column with option keys `step-free`, `hearing`, `quiet`, mirroring `interests`. OK?
- With no attendee-set need, the flag is simply absent (nothing like "all rooms step-free" is shown). OK?

## Out of scope
Using the hearing-loop and quiet-space needs anywhere beyond the profile; flags on the schedule grid or session cards; filtering or blocking bookings in non-accessible rooms.
