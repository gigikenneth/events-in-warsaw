// Luma's website API (unofficial). Geo search returns every public event near a
// point, unlike Luma's curated city page.
import { WARSAW, until, getJSON, mapLimit, docText, isEnglish } from '../util.js';

const API = 'https://api.lu.ma';

async function list() {
  const end = until(), out = [];
  let cursor = '';
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ latitude: WARSAW.lat, longitude: WARSAW.lon, pagination_limit: 50 });
    if (cursor) q.set('pagination_cursor', cursor);
    const d = await getJSON(`${API}/discover/get-paginated-events?${q}`);
    for (const e of d.entries) if (Date.parse(e.event.start_at) < end) out.push(e);
    const last = d.entries.at(-1);
    if (!d.has_more || !last || Date.parse(last.event.start_at) >= end) break;
    cursor = d.next_cursor;
  }
  return out;
}

export default async function luma() {
  const entries = await list();
  const details = await mapLimit(entries, 12, (e) => getJSON(`${API}/event/get?event_api_id=${e.api_id}`));
  return entries.map((e, k) => {
    const d = details[k], ev = e.event, geo = ev.geo_address_info || {};
    const description = d ? docText(d.description_mirror).trim() : '';
    return {
      id: e.api_id,
      source: 'Luma',
      name: ev.name,
      start: ev.start_at,
      end: ev.end_at,
      url: `https://luma.com/${ev.url}`,
      location: geo.full_address || geo.address || 'Warsaw',
      venue: geo.address || '',
      host: (e.calendar?.name !== 'Personal' && e.calendar?.name) || e.hosts?.[0]?.name || '',
      cover: ev.cover_url,
      free: !!e.ticket_info?.is_free,
      price: e.ticket_info?.price ? e.ticket_info.price.cents / 100 + ' ' + e.ticket_info.price.currency.toUpperCase() : '',
      description,
      topics: (d?.categories || []).map((c) => c.name).filter(Boolean),
      english: isEnglish(d?.locale, ev.name + '\n' + description),
    };
  });
}
