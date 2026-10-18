// Eventbrite has no public search API any more; its city page embeds the
// results as window.__SERVER_DATA__, so read that.
import { until, fetchOk, warsawToISO, isEnglish, stripHtml } from '../util.js';

const PAGE = 'https://www.eventbrite.com/d/poland--warszawa/all-events/';

async function page(n) {
  const html = await fetchOk(`${PAGE}?page=${n}`, { headers: { accept: 'text/html' } }).then((r) => r.text());
  const m = html.match(/__SERVER_DATA__\s*=\s*(\{.*?\});\s*\n/s);
  if (!m) throw new Error('eventbrite: no __SERVER_DATA__');
  return JSON.parse(m[1]).search_data.events;
}

export default async function eventbrite() {
  const first = await page(1);
  const rest = await Promise.all(
    Array.from({ length: Math.min(first.pagination.page_count, 5) - 1 }, (_, i) => page(i + 2).catch(() => ({ results: [] }))),
  );
  const end = until(), seen = new Set();
  return [first, ...rest].flatMap((p) => p.results).filter((e) => {
    const city = e.primary_venue?.address?.city || '';
    if (e.is_online_event || e.is_cancelled || seen.has(e.id) || (city && !/wars/i.test(city))) return false;
    seen.add(e.id);
    return true;
  }).map((e) => {
    const v = e.primary_venue || {}, a = v.address || {};
    const description = stripHtml(e.full_description || e.summary || '');
    return {
      id: 'eb-' + e.id,
      source: 'Eventbrite',
      name: e.name,
      start: warsawToISO(e.start_date, e.start_time),
      end: e.end_date ? warsawToISO(e.end_date, e.end_time) : '',
      url: e.url,
      location: [v.name, a.localized_address_display].filter(Boolean).join(', ') || 'Warsaw',
      venue: v.name || '',
      host: '',
      cover: e.image?.url || '',
      free: false,
      price: '',
      description,
      topics: (e.tags || []).filter((t) => t.prefix === 'EventbriteCategory').map((t) => t.display_name),
      english: isEnglish(null, e.name + '\n' + description), // its language field is the site locale, not the event's
    };
  }).filter((e) => Date.parse(e.start) < end && Date.parse(e.end || e.start) > Date.now());
}
