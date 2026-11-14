# Recommend sessions on My Agenda from the attendee's interests

## What this changes
My Agenda gains a "Recommended for you" section under the agenda list. It lists upcoming sessions tagged with any of the attendee's topic interests (set on My Profile), soonest first, leaving out sessions already held (seat or waitlist place) and sessions that have ended by the simulated clock. Each row has the usual add button (`SeatButton` via `toggleSeat`): it takes a seat or a waitlist place, the row leaves the recommendations and appears in the agenda list above without a reload, and a clash opens `<ConflictDialog>` (Keep / Swap). With no interests set the section instead prompts the attendee to pick some and links to `/profile`. It shows even when the agenda is empty.

## Where
- `src/lib/agendaView.js` — add `recommend(sessions, interests, reservationFor, clock, limit)`: tagged with any interest (`tags` of kind topic, by name), not `reservationFor`, not `hasEnded` (from `src/lib/clock.js`), sorted by `startsAt`/id, capped. Add `withSessions(days, sessions)`: merge extra sessions into the schedule's days (deduped by id) so `viewAgenda` can show a session added from a recommendation; test in `tests/unit/agendaView.test.js` (plain data, no database).
- `src/pages/MyAgendaPage.jsx` — also fetch `api.getUser(currentUserId)` (interests; the store's `currentUser` is the bootstrap copy and goes stale after a Profile save) and `api.getSessions()` (existing functions, no API change); feed the merged days to `viewAgenda`; render the section (`data-testid` `agenda-recommendations`, `recommendation`, `recommendation-add`, `recommendations-set-interests`) with `SeatButton` and the clock from `useConference()`. Keep the existing empty state for the agenda part.
- `tests/helpers.js` — new lane `agenda.recommend` (desktop marcus day 2, mobile jonas day 1; neither pair is used by another lane; `lanes.test.js` checks it).
- `tests/agenda.spec.js` — new test using `laneFor('agenda.recommend')`, `bookableFor`, `momentOn(0, '07:00')` and `?at=`; sets interests by `PUT /users/:id/interests` and restores them in `finally`.
- `context/engineering-context/agenda.md` — describe the section and `recommend`.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Upcoming sessions tagged with any interest appear, excluding held or ended ones | `recommend` returns matches for any interest, drops held (confirmed and waitlisted) and ended sessions | unit |
| The same, as the attendee sees it; the ended case pinned with `?at=` | spec: interests set to a tag, rows match tagged sessions, none of them on the agenda; at `momentOn(0,'15:00')` an ended Day 1 morning session tagged with the interest is absent | spec |
| Adding takes a seat or waitlist place and moves into the agenda without a reload | spec: click add, row leaves recommendations, appears in `agenda-session`, `__noReload` flag survives, `GET /users/:id/schedule` holds it | spec |
| A clash opens Keep / Swap | spec: hold an overlapping session, click add on a recommendation, the conflict dialog is visible | spec |
| With no interests, a prompt links to My Profile | spec: interests `[]`, `recommendations-set-interests` has href `/profile` | spec |
| Tests that depend on ended pin the clock | every spec visit passes `at` (`momentOn`) | spec |

## Decisions
- Cap the list at 8 sessions (soonest first) rather than listing every match — OK?
- Show the section even when the agenda is empty, below the empty state — OK?
- A full session is still recommended (its add button waitlists), rather than hidden — OK?
- Match on topic tags by name against the saved interests; tags of other kinds (e.g. level) never match — OK?

## Out of scope
Ranking by rating or popularity, a new endpoint, and showing recommendations anywhere but My Agenda.
