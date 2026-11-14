/**
 * Turns an attendee's own words into topic names, by asking Claude.
 * A plain object so tests can swap `available` and `suggest`.
 *
 * Credentials come from the SDK's own chain: `ANTHROPIC_API_KEY`, then
 * `ANTHROPIC_AUTH_TOKEN`, then the profile `ant auth login` stored under
 * `~/.config/anthropic/`. So on a laptop, signing in with `ant` is enough.
 */
import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '@anthropic-ai/sdk/core/credentials';

const MODEL = process.env.ORBIT_INTERESTS_MODEL || 'claude-opus-5-5';

let client;

export const model = {
  /** True when an API key, auth token or `ant` sign-in profile is there to use. */
  async available() {
    if (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN) return true;
    try {
      return Boolean(await loadConfig());
    } catch {
      return false;
    }
  },

  /** Names the model picked from `topicNames`; anything unparsable is `[]`. */
  async suggest(text, topicNames) {
    client ??= new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system: 'You map a conference attendee\'s interests onto a fixed list of topics. '
        + 'Include every topic an attendee with those interests would plausibly want talks on, '
        + 'including closely related and adjacent ones, not only the single closest match. '
        + 'Leave out topics with no real connection. '
        + 'Reply with only a JSON array of topic names copied exactly from the list, no other text.',
      messages: [{ role: 'user', content: `Topics: ${JSON.stringify(topicNames)}\n\nInterests: ${text}` }],
    });
    const raw = res.content.find((c) => c.type === 'text')?.text ?? '';
    try {
      const list = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
      return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : [];
    } catch {
      return [];
    }
  },
};
