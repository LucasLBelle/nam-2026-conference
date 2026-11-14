# Show the speakers from your sessions on My Agenda

## What this changes
My Agenda gains a **Speakers from your sessions** section between the day list and
Recommended for you. It lists each speaker of a session on the agenda once, in
order of their first session, with photo, name (a link to their speaker page),
LinkedIn handle as plain text (no link) when they have one, and a Follow /
Following button. Removing the last session by a speaker drops them without a
reload. With nothing on the agenda the section is not rendered (the page shows
its existing empty state).

No server change: `/users/:id/schedule` sessions already carry `speakers`
(`toSpeaker`: `imageUrl`, `initials`, `accent`, `socials.linkedin`), and so do the
`getSessions` rows that `withSessions` merges in when a recommendation is added.

## Where
- `src/lib/agendaView.js` — new pure `speakersOf(view)`: walks `view.days[].sessions[]`
  (already filtered through `reservationFor`, so removal needs no refetch), returns
  each speaker once by `id`, first appearance wins; `[]` for an empty view. Test in
  `tests/unit/agendaView.test.js` (existing `s()` helper gets a `speakers` field).
- `src/pages/MyAgendaPage.jsx` — compute `speakersOf(view)` beside `view`; inside the
  non-empty branch, after the day sections, render `<section data-testid="agenda-speakers">`
  only when the list is non-empty. Row `agenda-speaker`: `Avatar` (`imageUrl`), `Link` to
  `/speakers/:id`, LinkedIn handle in `agenda-speaker-linkedin` as a `span` (strip a
  leading `in/` as `SpeakerPage.handleOf` does; no `<a>`), and a `Button` toggling
  `toggleFollow(speaker.id)` from `useConference()` with `aria-pressed` and
  `data-testid="agenda-speaker-follow"`, label Follow / Following as on `SpeakerPage`.
- `tests/agenda.spec.js` — extend the existing `lists seats and waitlist places…` test
  (lane `agenda.page`; every attendee/day pair is already held by another lane, so a new
  writing lane cannot be added and a second test on this lane would race the first).
  Helpers: `laneFor`, `momentOn`, `bookableFor`, `visit`, `shotForPR`.
- `context/engineering-context/agenda.md` (and one line in `speakers.md` Follows) — the new
  section, helper and test ids.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Lists each speaker once, with name, photo, working Follow / Following | unit: a speaker on two sessions appears once, first-seen order; spec: the booked seat's speaker row has name linking to `/speakers/:id`, an `img` and, on click, `aria-pressed` flips and the speaker appears in `/users/:id` `followedSpeakers` (unfollowed again in `finally`, the follow state restored) | unit + spec |
| LinkedIn handle shown as text, no link | spec: `agenda-speaker-linkedin` has the handle text and the row has no `a` whose href contains `linkedin` (a speaker with a handle is picked from the booked sessions' payload) | spec |
| Removing the last session by a speaker removes them without a reload | unit: `viewAgenda` with the session unheld then `speakersOf` drops the speaker but keeps one still on another session; spec: speaker only on the removed seat leaves `agenda-speaker` after Remove, `__noReload` still true | unit + spec |
| Nothing on the agenda: section not shown | unit: `speakersOf` of an empty view is `[]`; spec: with the route-mocked empty schedule `agenda-speakers` has count 0 | unit + spec |

## Decisions
- Include speakers of waitlisted sessions as well as confirmed seats, since the page lists both under "agenda" — OK?

## Out of scope
Showing followed speakers on Home, filtering the list, any server or schema change, a Speakers link in the nav.
