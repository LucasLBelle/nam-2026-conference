# Let attendees set the highest session level they are comfortable with

## What this changes
My Profile gets a "Highest session level" choice: Beginner, Intermediate or Advanced, optional (click the chosen one again to clear), saved on click like the dietary choice. My Agenda's recommendations then list every session at or below that level first and the ones above it after them; each group stays soonest-first. "All Levels" sessions count as at or below any maximum. With no maximum, the order is exactly as today. Nothing is removed from the list.

## Where
- `server/db.js` — `users` table: add `max_level TEXT NOT NULL DEFAULT ''` beside `diet` ('' = not set; the seed needs no change, it is dropped and rebuilt).
- `server/lib/query.js` — `toUser`: add `maxLevel: row.max_level || null`.
- `server/routes/users.js` — `saveMaxLevel` statement, `LEVELS = ['Beginner', 'Intermediate', 'Advanced']`, and `PUT /:id/level` modelled on `PUT /:id/diet` (body `{ level }`, null clears, anything else 400, 404 for an unknown attendee; replies `{ level }`).
- `src/lib/api.js` — `putLevel(userId, level)` next to `putDiet`.
- `src/lib/agendaView.js` — `recommend(...)`: new trailing parameter `maxLevel = null`. Rank each session 0 (level is "All Levels" or at or below the maximum) or 1 (above), with Beginner < Intermediate < Advanced; sort by rank first, then the existing day/start/id order, then `slice(limit)`. A null maximum ranks everything 0, so the order is unchanged.
- `src/pages/ProfilePage.jsx` — new `MaxLevel` section modelled on `Diet` (`data-testid="profile-level"`, options `data-testid="level-option"`), rendered after `ArrivalDeparture`.
- `src/pages/MyAgendaPage.jsx` — read `me.data?.maxLevel` beside `arrival` and pass it to `recommend`, adding it to the `useMemo` dependencies.
- Tests: `tests/unit/agendaView.test.js` (the `r()` fixture builder; add a `level` to the fixtures); `tests/api/level.test.js` modelled on `tests/api/diet.test.js` with `startApi()`; `tests/profile-level.spec.js` modelled on `tests/window.spec.js` with `laneFor('profile.level', testInfo)`, `momentOn(0, '07:00')` to pin the clock, and a new read-only `'profile.level'` lane in `tests/helpers.js` `LANES` on an attendee and day no other lane writes interests for (`tests/unit/lanes.test.js` checks the pair is free).
- Docs: `context/engineering-context/agenda.md` (recommendations and the profile endpoints).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Maximum choice on My Profile, optional, persisted per attendee | `PUT /users/:id/level` saves and a read returns `maxLevel`; null clears; invalid is 400; another attendee unaffected | API (`tests/api/level.test.js`) |
| Maximum choice on My Profile | Choose Intermediate, reload, still chosen; click it again, cleared; My Agenda then lists a session above it after those at or below | Spec (`tests/profile-level.spec.js`) |
| Above-maximum recommendations come after every one at or below | `recommend(..., 'Intermediate')` over an Advanced session that starts earlier than a Beginner and an Intermediate one returns the two first, the Advanced last | Unit |
| "All Levels" ranks as at or below any maximum | An "All Levels" session starting after an Advanced one still precedes it with maximum Beginner | Unit |
| No maximum, order unchanged | `recommend` with null, or no argument, returns the plain soonest-first order of the same fixtures, Advanced included | Unit |
| Unit tests cover the ordering | The three rows above, plus within-group soonest-first and `limit` applied after reordering | Unit (`tests/unit/agendaView.test.js`) |

## Decisions
- Within each group, are sessions kept soonest-first, with the limit of eight applied after the reorder (so above-maximum sessions only show once the others run out)?
- Are the choices exactly Beginner, Intermediate and Advanced, with "All Levels" left out because it is a session label, not something an attendee can be comfortable up to?
- Is the section on My Profile placed last, after Arrival and departure?

## Out of scope
Hiding or marking above-maximum sessions, and any use of the maximum outside My Agenda's recommendations (Schedule filters, Home).
