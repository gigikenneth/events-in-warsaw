// Luma's public website API (unofficial). Geo search returns every public event
// near a point, unlike the curated city page.
const API = 'https://api.lu.ma';
const WARSAW = { latitude: 52.2297, longitude: 21.0122 };
const DAYS_AHEAD = 35;
const PLACE = 'discplace-PTcuEQVHuySJe8N'; // Luma's curated Warsaw page

const EN = new Set('the and of for with you your we our will is are this join in at an be from about by us it what how who'.split(' '));
const PL = new Set('i w na z się jest dla oraz do że nie to jak co czy po przez od o ze sa są jako być będzie spotkanie zapraszamy'.split(' '));

// Walk Luma's ProseMirror doc into plain text.
function docText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text;
  if (node.type === 'hard_break') return '\n';
  const inner = (node.content || []).map(docText).join('');
  return ['paragraph', 'heading', 'list_item'].includes(node.type) ? inner + '\n' : inner;
}

function vote(text) {
  let en = 0, pl = 0;
  for (const w of text.toLowerCase().match(/\p{L}+/gu) || []) {
    if (EN.has(w)) en++;
    else if (PL.has(w)) pl++;
  }
  return { en, pl };
}

// ponytail: stopword vote, swap for a real detector (franc) if it misfires a lot
export function isEnglish(locale, text) {
  const all = vote(text), lead = vote(text.slice(0, 400));
  if (all.en >= 15) return true; // a full English section, bilingual events count
  if (lead.en + lead.pl >= 6 && lead.en > lead.pl) return true; // opens in English
  if (all.en + all.pl >= 8) return all.en > all.pl;
  return locale === 'en';
}

async function getJSON(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function listEvents() {
  const until = Date.now() + DAYS_AHEAD * 864e5;
  const out = [];
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ ...WARSAW, pagination_limit: 50 });
    if (cursor) q.set('pagination_cursor', cursor);
    const d = await getJSON(`${API}/discover/get-paginated-events?${q}`);
    for (const e of d.entries) if (Date.parse(e.event.start_at) < until) out.push(e);
    const last = d.entries.at(-1);
    if (!d.has_more || !last || Date.parse(last.event.start_at) >= until) break;
    cursor = d.next_cursor;
  }
  return out;
}

async function mapLimit(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]).catch(() => null); }
  }));
  return res;
}

export async function getEvents() {
  const [list, place] = await Promise.all([
    listEvents(),
    getJSON(`${API}/discover/get-paginated-events?discover_place_api_id=${PLACE}&pagination_limit=100`).catch(() => null),
  ]);
  const onCityPage = new Set(place?.entries.map((e) => e.api_id));
  const details = await mapLimit(list, 12, (e) => getJSON(`${API}/event/get?event_api_id=${e.api_id}`));
  return list.map((e, k) => {
    const d = details[k];
    const ev = e.event;
    const description = d ? docText(d.description_mirror).trim() : '';
    const geo = ev.geo_address_info || {};
    return {
      id: e.api_id,
      name: ev.name,
      start: ev.start_at,
      end: ev.end_at,
      url: `https://luma.com/${ev.url}`,
      location: geo.full_address || geo.address || 'Warsaw',
      venue: geo.address || '',
      host: (e.calendar?.name !== 'Personal' && e.calendar?.name) || e.hosts?.[0]?.name || '',
      cover: ev.cover_url,
      guests: e.guest_count || 0,
      free: !!e.ticket_info?.is_free,
      price: e.ticket_info?.price ? e.ticket_info.price.cents / 100 + ' ' + e.ticket_info.price.currency.toUpperCase() : '',
      soldOut: !!e.ticket_info?.is_sold_out,
      description,
      onCityPage: onCityPage.has(e.api_id),
      locale: d?.locale || '',
      english: isEnglish(d?.locale, ev.name + '\n' + description),
    };
  });
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
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//luma-warsaw//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Warsaw on Luma (English)', 'X-WR-TIMEZONE:Europe/Warsaw',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H',
  ];
  for (const e of events) {
    const blurb = e.description.length > 600 ? e.description.slice(0, 600) + '…' : e.description;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@luma-warsaw`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end || e.start)}`,
      `SUMMARY:${esc(e.name)}`,
      `LOCATION:${esc(e.location)}`,
      `URL:${e.url}`,
      `DESCRIPTION:${esc(`Register: ${e.url}\n${e.host ? 'Host: ' + e.host + '\n' : ''}\n${blurb}`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
