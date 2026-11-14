# Show the attendee's sessions on My Agenda with a way to remove them

## What this changes
`/my-agenda` stops being a "Coming soon" panel. It lists the signed-in attendee's sessions from `/users/:id/schedule`, grouped by day and ordered by start time. Confirmed seats and waitlist places look different (a "Waitlisted" mark on the latter). A stat shows booked time (confirmed seats only) with `+Nh waitlisted` beside it. Each row has a Remove button that calls the store's `toggleSeat`, and the row disappears without a reload. With nothing booked, an empty state links to `/schedule`.

## Where
- `src/lib/agendaView.js` (new, pure) — `viewAgenda(days, reservationFor)`: re-filters each day through the store's `reservationFor`, drops empty days, recomputes `bookedMinutes` (confirmed) and `waitlistedMinutes` per day and in total (agenda doc, "Building on it"); unit test in `tests/unit/agendaView.test.js`.
- `src/pages/MyAgendaPage.jsx` — fetch with `useFetch(() => api.getSchedule(currentUserId), [currentUserId])`, render `viewAgenda` output with `SessionCard variant="row"` or a small row, a `Stat` with `note` for `+Nh waitlisted`, Remove button -> `toggleSeat(s.id, s)`, empty state (`agenda-empty`) with a `Button to="/schedule"`. Test ids: `agenda-day`, `agenda-session`, `agenda-waitlisted`, `agenda-booked`, `agenda-remove`.
- `tests/helpers.js` — add a data lane `agenda.page` to `LANES` (own attendee and day per project; `clean` day for the empty and remove cases); `tests/unit/lanes.test.js` must stay green.
- `tests/agenda.spec.js` (new) — uses `visit`, `laneFor('agenda.page', testInfo)`, `clearAgendaFor`, `bookableFor`; books through the API, releases afterwards.
- `tests/home.spec.js` — the nav test asserts `agenda-coming-soon`; change it to assert the My Agenda page (`/my-agenda` URL and heading, as `/my-plan` redirect).
- `context/engineering-context/agenda.md` — replace "My Agenda is a placeholder" with the built page; `CLAUDE.md` "Deliberately unbuilt" bullet for My Agenda is updated to say it is built.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Lists confirmed and waitlisted sessions by day and time, waitlisted marked | `viewAgenda` groups and orders by day/time and keeps status; spec books one seat and one waitlist place via the API, expects `agenda-session` rows in time order and `agenda-waitlisted` on only the queued one | unit + spec |
| Booked time counts confirmed seats only; waitlisted shown separately | `viewAgenda` totals: confirmed 60 + waitlisted 90 gives booked 60, waitlisted 90; spec reads `agenda-booked` and the `+Nh waitlisted` note | unit + spec |
| Removing releases the seat and removes the row without a reload | spec clicks `agenda-remove`, row count drops, no navigation, and `/users/:id/schedule` no longer holds the session | spec |
| Empty state links to the Schedule | spec on a `clean` day-less attendee lane: `agenda-empty` visible with link to `/schedule`; `agenda-coming-soon` is gone | spec |

## Decisions
- Show the whole agenda, past sessions included, rather than only upcoming ones — OK?
- Replace the `agenda-coming-soon` test id outright (home.spec updated) instead of keeping it — OK?
- Reuse `SessionCard variant="row"` if it fits, otherwise a plain row in the page — OK?

## Out of scope
Adding sessions from the Schedule, recommendations, check-in or rating from this page, `.ics` export.
