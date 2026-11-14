# Add a My Profile page reachable from a Profile tab in the top nav

## What this changes
A **Profile** tab joins the top navigation (desktop bar and mobile menu) and opens `/profile`, "My Profile". It shows the signed-in attendee's avatar, name, pronouns, job title, company, bio and email, read from `GET /api/users/:id`. Switching attendee in the switcher re-fetches and shows the new attendee without a reload. Read-only.

## Where
- `src/pages/ProfilePage.jsx` (new) — `useConference().currentUser` for the id, `useFetch(() => api.getUser(id), [id])`; `SectionHeader` "My Profile", `Avatar`, fields with `data-testid="profile-*"`; Spinner/ErrorState like `SpeakerPage`.
- `src/App.jsx` — `<Route path="profile" element={<ProfilePage />} />` inside `<Layout>`.
- `src/components/Layout.jsx` — `NAV` gains `{ to: '/profile', label: 'Profile', icon: 'users' }` (one array drives desktop and mobile).
- `src/lib/api.js` — `getUser` already exists; no change. No server change.
- `tests/profile.spec.js` (new) — `visit`, `ATTENDEES`, `failOnPageErrors` from `tests/helpers.js`; read-only, so no data lane. Also add `/profile` to `ROUTES` in `tests/smoke.spec.js`.
- `context/engineering-context/ui.md` — mention the Profile nav item; `architecture.md` — add `/profile` to the route list.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Profile tab in top nav on desktop and mobile, opens the page | click "Profile" link in the `Main` nav (desktop project) / `Mobile` nav (mobile project), expect URL `/profile` and heading "My Profile" | spec |
| Page shows name, pronouns, job title, company, bio, email | as Kenji, expect each value from `GET /api/users/3` visible in its `profile-*` element | spec |
| Switching attendee updates the page without a reload | on `/profile`, choose another attendee in the switcher, expect the name/email to change and no navigation | spec |
| Page renders cleanly, no overflow | `/profile` row in smoke `ROUTES` | spec |

## Decisions
- Route is `/profile`, tab label "Profile", placed after My Agenda — OK?
- Fields with no value (e.g. empty pronouns) are omitted rather than shown as blanks — OK?
- The tab uses the existing `users` icon rather than adding a new one — OK?

## Out of scope
Editing details; interests.
