# Let attendees set dietary requirements on My Profile

## What this changes
My Profile gains a "Dietary requirements" section: vegan, vegetarian, gluten-free (one at a time; click the chosen one again to clear). It saves on click and survives a reload, per attendee. Opening `/food` with no `dietary` in the URL applies that diet as the Dietary filter; a `dietary` in the URL wins; choosing "Any dietary" on the Food page clears the filter and it stays cleared. With no diet set, Food behaves as it does today.

## Where
- `server/db.js` — add `diet TEXT NOT NULL DEFAULT ''` to the `users` table in `SCHEMA` (beside `access_needs`; the seed drops and recreates tables, so no migration).
- `server/lib/query.js` — `toUser`: add `diet: row.diet || null` (camelCase mapper).
- `server/routes/users.js` — next to `ACCESS_NEEDS`, add `const DIETS = ['vegan', 'vegetarian', 'gluten-free']`, a `saveDiet` statement, and `PUT /:id/diet` taking `{ diet }` (a DIETS value, or `null` to clear): 404 unknown attendee, 400 for anything else. Replies `{ diet }`.
- `src/lib/api.js` — `putDiet(userId, diet)`, beside `putAccessNeeds`.
- `src/pages/ProfilePage.jsx` — a `Diet` section component modelled on `AccessNeeds` (`data-testid="profile-diet"`, buttons `data-testid="diet-option"` with `aria-pressed`, single-select), rendered under `<AccessNeeds />`.
- `src/pages/FoodPage.jsx` — `FoodPage`: fetch the attendee with `api.getUser(currentUser.id)` (`useConference().currentUser`); `dietary = params.get('dietary') ?? profileDiet ?? ALL`. Hold the vendor fetch until the attendee has loaded when the URL has no `dietary`, so the unfiltered list never flashes. In `set`, when clearing `dietary` and a profile diet exists, write `dietary=all` to the URL instead of deleting it, so the profile does not re-apply.
- `tests/api/endpoints.test.js` — add `PUT /users/999999/diet` to the unknown-attendee writes and `'PUT users/:id/diet'` to the route list.
- Tests: `tests/api/diet.test.js` (modelled on `tests/api/access-needs.test.js`, `startApi()`); `tests/diet.spec.js` using a new lane `diet.profile` in `LANES` in `tests/helpers.js` (`laneFor`, `visit`), pinning the clock with `momentOn`.
- Docs: `context/engineering-context/venues.md` (FoodPage), `data-model.md` (users), `ui.md` (Profile) — one line each.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Profile lists the three diets; selections persist per attendee | `tests/api/diet.test.js`: starts `null`, PUT saves and replies, a read returns it, another attendee unaffected, `null` clears | API |
| Same, as the attendee sees it | `tests/diet.spec.js`: three options on `/my-profile`, select, reload, still pressed | spec |
| `/food` with no `dietary` applies the diet | `tests/diet.spec.js`: the Dietary select shows the diet and every listed vendor carries it | spec |
| URL value wins; clearing works | `tests/diet.spec.js`: `/food?dietary=vegan` with gluten-free saved shows vegan; choosing "Any dietary" leaves the URL on `dietary=all` and the full list, surviving a reload | spec |
| No diet set: as today | `tests/diet.spec.js`: with the diet cleared, `/food` shows Any dietary and the full vendor count (holds on main; guards the new fetch hold) | spec |
| API saves, reads, rejects unknown | `tests/api/diet.test.js`: `{ diet: 'keto' }`, a number and a missing body give 400 and leave the saved value; unknown attendee gives 404 | API |

## Decisions
- Two criteria already hold on main (no diet set behaves as today; clearing the filter works, since no profile exists to re-apply). This build proves them as regressions against the new profile default, not as new behaviour — OK?
- One diet at a time, since the Food filter takes a single value, rather than a multi-select — OK?
- Clearing writes `dietary=all` into the URL (a shared link then shows everything, not the sharer's diet) rather than remembering the clear in state — OK?

## Out of scope
Showing the diet anywhere else (Home, My Agenda), allergies, filtering the Food page by more than one diet.
