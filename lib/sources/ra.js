// Resident Advisor's website GraphQL endpoint (unofficial). Club nights, so the
// language filter doesn't apply; they count as English-friendly.
import { postJSON, warsawToISO, DAYS_AHEAD } from '../util.js';

const AREA = 454; // Warsaw
const QUERY = `query($f: FilterInputDtoInput, $page: Int) {
  eventListings(filters: $f, pageSize: 100, page: $page) {
    totalResults
    data { event { id title startTime endTime contentUrl images { filename } venue { name address } genres { name } } }
  }
}`;

const iso = (local) => warsawToISO(local.slice(0, 10), local.slice(11, 16)); // RA times are Warsaw wall-clock

export default async function ra() {
  const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const f = { areas: { eq: AREA }, listingDate: { gte: day(0), lte: day(DAYS_AHEAD) } };
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const d = await postJSON('https://ra.co/graphql', { query: QUERY, variables: { f, page } }, { referer: 'https://ra.co/events/pl/warsaw' });
    const r = d.data?.eventListings;
    if (!r) throw new Error('ra: ' + JSON.stringify(d.errors || d).slice(0, 200));
    out.push(...r.data.map((x) => x.event));
    if (out.length >= r.totalResults || !r.data.length) break;
  }
  const seen = new Set();
  return out.filter((e) => !seen.has(e.id) && seen.add(e.id)).map((e) => ({
    id: 'ra-' + e.id,
    source: 'Resident Advisor',
    name: e.title,
    start: iso(e.startTime),
    end: e.endTime ? iso(e.endTime) : '',
    url: 'https://ra.co' + e.contentUrl,
    location: [e.venue?.name, e.venue?.address].filter(Boolean).join(', ') || 'Warsaw',
    venue: e.venue?.name || '',
    host: '',
    cover: e.images?.[0]?.filename || '',
    free: false,
    price: '',
    description: (e.genres || []).map((g) => g.name).join(', '),
    topics: ['Music & Nightlife'],
    onCityPage: false,
    english: true,
  }));
}
