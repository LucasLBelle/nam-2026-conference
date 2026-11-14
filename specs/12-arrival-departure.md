# Let attendees set when they arrive and leave on My Profile

## What this changes
My Profile gets an "Arriving and leaving" card: arrival and departure, each a day (one of the conference days) plus a time, both optional and clearable. They are saved per attendee. A departure earlier than the arrival is refused with "Departure can't be earlier than arrival" and nothing is saved. On My Agenda, *Recommended for you* drops any session that is not wholly inside the window (starts before arrival or ends after departure); with neither set, nothing is dropped, and with only one set, only that side applies.

## Where
- `server/db.js` — add `arrives_at TEXT NOT NULL DEFAULT ''` and `departs_at TEXT NOT NULL DEFAULT ''` to `users` (value `YYYY-MM-DDTHH:MM`, the same shape as `?at=`; plain strings compare in order). The seed rebuilds the DB, so no migration.
- `server/lib/query.js` — `toUser` (beside `interests`/`diet`): `arrival: row.arrives_at || null`, `departure: row.departs_at || null`.
- `server/routes/users.js` — `PUT /:id/window` beside `/diet`, body `{ arrival, departure }` (each `null` or `{ day, time }`; keep the pair as one request so the order check is atomic). 404 unknown attendee; 400 when `day` is not a `days` row or `time` is not `HH:MM`; 400 `Departure can't be earlier than arrival` when both set and departure < arrival (equal is allowed). Replies `{ arrival, departure }` read back through `toUser`.
- `src/lib/api.js` — `putWindow(userId, arrival, departure)` beside `putDiet`.
- `src/lib/agendaView.js` — `recommend(sessions, interests, reservationFor, clock, limit = 8, window = {})`: add a filter keeping a session only if `!arrival || key(s.day, s.startsAt) >= arrival` and `!departure || key(s.day, s.endsAt) <= departure`. `window` is last so existing callers and tests stay valid.
- `src/pages/MyAgendaPage.jsx` — pass `{ arrival: me.data?.arrival, departure: me.data?.departure }` to `recommend` (fresh from `api.getUser`, as `interests` already is) and add them to the `useMemo` deps.
- `src/pages/ProfilePage.jsx` — `ArrivalDeparture({ userId, saved })` in the style of `Diet`: a `<select>` of conference days (from `useConference().days`) and `<input type="time">` for each end, a Save button, error toast on a 400 showing `err.message`, a Clear per end. Test ids `profile-window`, `arrival-day`, `arrival-time`, `departure-day`, `departure-time`, `window-save`, `window-clear-arrival`, `window-clear-departure`.
- Tests: `tests/unit/agendaView.test.js` (reuse its `r()` builder and `now`); `tests/api/interests.test.js` is the model for a new `tests/api/window.test.js` (`startApi`, `api.put`, KENJI/MARCUS ids); `tests/window.spec.js` using `visit`, `momentOn`, `conferenceDays`, `bookableFor`, `shotForPR` from `tests/helpers.js`, with a new lane `'profile.window'` added to `LANES` (desktop and mobile on two attendees no other spec writes interests or a window for; the spec restores `null`/`null` and the original interests in `finally`). Add `'PUT users/:id/window'` to the route list in `tests/api/endpoints.test.js`. Docs: `context/engineering-context/agenda.md` (recommend signature and rule), `data-model.md` (the two columns).

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Arrival and departure persisted per attendee, both optional | `PUT /users/:id/window` stores both, a `GET /users/:id` returns them, another attendee is unchanged, `null`/`null` clears, one alone is fine; bad day or time is 400 | API (`tests/api/window.test.js`) |
| Departure earlier than arrival rejected with a clear message | PUT with departure before arrival is 400 with the exact message and the stored window unchanged; equal is 200 | API (`tests/api/window.test.js`) |
| My Profile has the fields, saved and shown after reload; the message appears | Set arrival and departure on `/profile`, reload and see them; set departure before arrival and see the message, saved values unchanged | Spec (`tests/window.spec.js`) |
| Recommendations exclude sessions outside the window; neither set excludes nothing | `recommend` with sessions before, inside, after, straddling either edge; only arrival, only departure; none set equals today's output | Unit (`tests/unit/agendaView.test.js`) |
| Same on the page, clock pinned | With an interest set and `at` = lane day `07:00` via `momentOn`, a window around one session leaves it and hides the one before and the one after; clearing the window brings them back | Spec (`tests/window.spec.js`) |

## Decisions
- A session straddling an edge (starts before arrival, or ends after departure) is excluded, because "outside the window" is read as "not fully attendable" — OK?
- Departure equal to arrival is accepted (a zero-length window), only strictly earlier is rejected — OK?
- Arrival and departure are saved together with one Save button rather than on each change, so an invalid pair is never half-stored — OK?
- Only recommendations are filtered; sessions already on the agenda stay listed even if outside the window — OK?

## Out of scope
Filtering `/schedule`, the `suggestions` endpoint or the Day view by the window; time zones (times are conference-local like `?at=`); seeding windows for the seeded attendees.
