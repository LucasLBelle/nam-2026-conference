# Let attendees describe their interests in their own words and have them mapped to topics

## What this changes
Home gets a **Tell me what you're interested in** entry, the same for everyone. It opens a text box; one submit sends the text to Claude along with the names of every topic tag, keeps only names that are real topic tags, saves them as the attendee's interests, and lands on My Profile (`/profile`) with the note "We've set your interests based on what you told us". The chips there show the new selection and toggle as before. With no credentials (no `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` or `ant auth login` profile) the entry says the feature is unavailable instead of failing.

## Where
- `server/lib/interestsModel.js` (new) — `model = { available(), suggest(text, topicNames) }`; `suggest` calls the Messages API through `@anthropic-ai/sdk` (a bare `new Anthropic()`, so an `ant auth login` sign-in works on a laptop as well as a key), asks for a JSON array of names, returns an array (anything unparsable becomes `[]`). Exported as a mutable object so tests swap it.
- `server/routes/users.js` — new `POST /:id/interests/describe` beside the existing `PUT`: 404 unknown attendee, 400 if `text` is not a non-empty string, 503 `{ error }` when `!model.available()`, otherwise filter the model's output to `topicNames` (deduped), save with the existing `saveInterests` and reply `{ interests }` as the PUT does. Test in `tests/api/interests.test.js` (add a `describe` block; `startApi()` runs in-process so the test replaces `model.suggest` / `model.available`; Kenji and Marcus as the existing tests).
- `src/lib/api.js` — `describeInterests(userId, text)`.
- `src/pages/HomePage.jsx` — `DescribeInterests` section (`describe-interests`): button `describe-interests-open` reveals a textarea (`describe-interests-text`) and Submit (`describe-interests-submit`); on success `navigate('/profile', { state: { interestsSet: true } })`; a 503 shows its message inline (`describe-interests-error`). Uses `currentUser.id` from `useConference()` only when submitting, so nothing on Home displays anything attendee-specific.
- `src/pages/ProfilePage.jsx` — read `useLocation().state?.interestsSet` and show the note (`interests-note`) in the Interests section. The chips already read the saved list.
- `tests/interests.spec.js` — add a spec using `visit`, `ATTENDEES` and the existing desktop-Kenji / mobile-Marcus split, restoring the original interests afterwards. The browser spec fulfils the describe request via `page.route` after doing the real `PUT` (the dev server has no model), so it proves the UI path only.

## How it will be proved
| Done when | Check | Layer |
| --- | --- | --- |
| Typing saves a sensible set of existing topic tags and opens My Profile with those chips pressed and the note shown | Spec types text on Home, submits, expects URL `/profile`, `interests-note` visible, the returned chips `aria-pressed=true`; API test: stubbed model returning two topics saves exactly those and `GET /users/:id` shows them | Playwright + API |
| The interests remain editable on My Profile | Spec clicks a pressed chip after landing and expects `aria-pressed=false` | Playwright |
| Without an API key nothing breaks and the entry explains the feature is unavailable | API test: no key → 503 with an error and interests unchanged; spec: a 503 shows `describe-interests-error` and stays on Home | API + Playwright |
| API tests cover dropping non-topic names, saving the rest, and the no-key path | New cases in `tests/api/interests.test.js`: model returns `[topic, 'Python', 'Nonsense']` → only the topic saved and returned; empty/missing `text` → 400; unknown attendee → 404 | API |

## Decisions
- Should the describe route save the filtered list itself (sharing the PUT's `saveInterests` statement and its topic check), rather than the browser calling `PUT /interests` afterwards?
- Should the text replace the attendee's existing interests rather than add to them?
- If the model returns no real topic tag at all, should we save nothing and show "couldn't match any topics" on Home rather than clearing interests and going to My Profile?
- Is the unavailable message shown when the attendee submits (a 503), rather than checking availability in advance?
- Is the end-to-end spec allowed to stub the describe request in the browser, since the dev server has no model?

## Out of scope
Voice input; a multi-turn chat; the Anthropic SDK; any change to the existing `PUT` route.
