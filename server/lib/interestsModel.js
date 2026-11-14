/**
 * Turns an attendee's own words into topic names, by asking Claude.
 * A plain object so tests can swap `available` and `suggest`; there is no SDK,
 * just one call to the Messages API.
 */
const MODEL = process.env.ORBIT_INTERESTS_MODEL || 'claude-haiku-4-5';

export const model = {
  available: () => Boolean(process.env.ANTHROPIC_API_KEY),

  /** Names the model picked from `topicNames`; anything unparsable is `[]`. */
  async suggest(text, topicNames) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: 'You map a conference attendee\'s interests onto a fixed list of topics. '
          + 'Reply with only a JSON array of topic names copied exactly from the list, no other text.',
        messages: [{ role: 'user', content: `Topics: ${JSON.stringify(topicNames)}\n\nInterests: ${text}` }],
      }),
    });
    if (!res.ok) throw new Error(`model request failed: ${res.status}`);
    const body = await res.json();
    const raw = body.content?.find((c) => c.type === 'text')?.text ?? '';
    try {
      const list = JSON.parse(raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1));
      return Array.isArray(list) ? list.filter((n) => typeof n === 'string') : [];
    } catch {
      return [];
    }
  },
};
