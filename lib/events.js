import luma from './sources/luma.js';
import meetup from './sources/meetup.js';
import eventbrite from './sources/eventbrite.js';
import ra from './sources/ra.js';
import { keywordTopics, TOPIC_NAMES } from './util.js';

// Order = priority when the same event is on several sites (first one's details win).
const SOURCES = { Luma: luma, Meetup: meetup, Eventbrite: eventbrite, 'Resident Advisor': ra };

const CATEGORY_MAP = {
  'Science & Technology': 'Tech', 'Business & Professional': 'Business', Music: 'Music & Nightlife',
  'Health & Wellness': 'Wellness', 'Sports & Fitness': 'Fitness', 'Food & Drink': 'Food & Drink',
  'Performing & Visual Arts': 'Arts & Culture', 'Film, Media & Entertainment': 'Arts & Culture',
  'Community & Culture': 'Social', 'Hobbies & Special Interest': 'Games', 'Nightlife': 'Music & Nightlife',
};

const warsawDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' });
const STOP = new Set(['warsaw', 'warszawa', 'the', 'and', 'meetup', 'event', 'with', 'for', 'edition']);
const words = (s) => new Set(s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) || []);

export function sameEvent(a, b) {
  if (warsawDay.format(new Date(a.start)) !== warsawDay.format(new Date(b.start))) return false;
  const wa = words(a.name), wb = words(b.name);
  if (!wa.size || !wb.size) return false;
  let both = 0;
  for (const w of wa) if (wb.has(w)) both++;
  return both / Math.min(wa.size, wb.size) >= 0.6; // ponytail: title overlap on the same day, add venue check if it over-merges
}

function merge(events) {
  const out = [];
  for (const e of events) {
    // same event cross-posted to another site, or reposted by another group on the same site
    const twin = out.find((o) => (o.name === e.name && o.start === e.start) || (!o.links.some((l) => l.source === e.source) && sameEvent(o, e)));
    if (twin && twin.links.some((l) => l.source === e.source)) continue;
    if (!twin) { out.push({ ...e, links: [{ source: e.source, url: e.url }] }); continue; }
    twin.links.push({ source: e.source, url: e.url });
    twin.english ||= e.english;
    twin.topics = [...new Set([...twin.topics, ...e.topics])];
    twin.cover ||= e.cover;
    twin.host ||= e.host;
    if (e.description.length > twin.description.length) twin.description = e.description;
  }
  return out;
}

export async function getEvents() {
  const names = Object.keys(SOURCES);
  const results = await Promise.allSettled(names.map((n) => SOURCES[n]()));
  const status = {}, all = [];
  results.forEach((r, i) => {
    status[names[i]] = r.status === 'fulfilled' ? r.value.length : 'error: ' + String(r.reason?.message || r.reason).slice(0, 120);
    if (r.status === 'fulfilled') all.push(...r.value);
  });
  for (const e of all) {
    const mapped = e.source === 'Luma' ? e.topics : e.topics.map((t) => CATEGORY_MAP[t] || (TOPIC_NAMES.has(t) ? t : null)).filter(Boolean); // keep sources' own labels that already match ours
    e.topics = [...new Set(e.source === 'Luma' && mapped.length ? mapped : [...mapped, ...keywordTopics(e.name + '\n' + e.description.slice(0, 300))])];
  }
  // stable sort by source priority, so merge keeps the higher-priority copy
  all.sort((a, b) => names.indexOf(a.source) - names.indexOf(b.source));
  const events = merge(all).sort((a, b) => a.start.localeCompare(b.start));
  return { events, status };
}

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (iso) => iso.replace(/[-:]/g, '').replace(/\.\d+/, '');

// RFC 5545: fold lines over 75 octets.
function fold(line) {
  const parts = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > 75) { parts.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  parts.push(cur);
  return parts.join('\r\n');
}

export function toICS(events) {
  const now = stamp(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//events-in-warsaw//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:wyd warsaw? (English)', 'X-WR-TIMEZONE:Europe/Warsaw',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    const blurb = e.description.length > 600 ? e.description.slice(0, 600) + '…' : e.description;
    const links = e.links.map((l) => `${l.source}: ${l.url}`).join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@luma-warsaw`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end || e.start)}`,
      `SUMMARY:${esc(e.name)}`,
      `LOCATION:${esc(e.location)}`,
      `URL:${e.url}`,
      `DESCRIPTION:${esc(`${links}\n${e.host ? 'Host: ' + e.host + '\n' : ''}\n${blurb}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
