import { db } from '../db.js';

const conferenceDay = db.prepare('SELECT 1 FROM sessions WHERE day = ? LIMIT 1');
const saveWindow = db.prepare('UPDATE users SET arrives_at = ?, departs_at = ? WHERE id = ?');

/** `{ day, time }` → 'YYYY-MM-DDTHH:MM', '' for null, undefined when not a conference day and an HH:MM time. */
function windowKey(end) {
  if (end === null) return '';
  if (!end || typeof end.day !== 'string' || typeof end.time !== 'string') return undefined;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(end.time) || !conferenceDay.get(end.day)) return undefined;
  return `${end.day}T${end.time}`;
}

/** Store an attendee's arrival and departure together, so an invalid pair is never half-saved. Returns an error message or null. */
export function setWindow(userId, arrival, departure) {
  const arrives = windowKey(arrival);
  const departs = windowKey(departure);
  if (arrives === undefined || departs === undefined) {
    return 'arrival and departure must each be null or a conference day and an HH:MM time';
  }
  if (arrives && departs && departs < arrives) return "Departure can't be earlier than arrival";
  saveWindow.run(arrives, departs, userId);
  return null;
}
