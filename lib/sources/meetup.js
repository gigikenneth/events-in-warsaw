// Meetup's website GraphQL endpoint (unofficial, same one meetup.com/find uses).
import { WARSAW, until, postJSON, isEnglish } from '../util.js';

const QUERY = `query($f: RecommendedEventsFilter!, $after: String) {
  recommendedEvents(filter: $f, first: 50, after: $after, sort: { sortField: DATETIME }) {
    pageInfo { hasNextPage endCursor }
    edges { node {
      id title dateTime endTime eventUrl eventType description
      featuredEventPhoto { baseUrl id }
      group { name }
      venue { name address city }
      feeSettings { amount currency }
    } }
  }
}`;

export default async function meetup() {
  const end = until(), out = [], seen = new Set();
  let after = null;
  for (let page = 0; page < 10; page++) {
    const d = await postJSON('https://www.meetup.com/gql2', {
      query: QUERY,
      variables: { after, f: { lat: WARSAW.lat, lon: WARSAW.lon, radius: 15, startDateRange: new Date().toISOString() } },
    });
    const r = d.data?.recommendedEvents;
    if (!r) throw new Error('meetup: ' + JSON.stringify(d.errors || d).slice(0, 200));
    for (const { node: e } of r.edges) {
      if (e.eventType !== 'PHYSICAL' || seen.has(e.id) || Date.parse(e.dateTime) >= end) continue;
      seen.add(e.id);
      const v = e.venue || {}, fee = e.feeSettings, p = e.featuredEventPhoto;
      const description = e.description || '';
      out.push({
        id: 'mu-' + e.id,
        source: 'Meetup',
        name: e.title,
        start: new Date(e.dateTime).toISOString(),
        end: e.endTime ? new Date(e.endTime).toISOString() : '',
        url: e.eventUrl,
        location: [v.name, v.address, v.city].filter(Boolean).join(', ') || 'Warsaw',
        venue: v.name || '',
        host: e.group?.name || '',
        cover: p ? `${p.baseUrl}${p.id}/676x380.webp` : '',
        free: !fee,
        price: fee ? `${fee.amount} ${fee.currency}` : '',
        description,
        topics: [],
        english: isEnglish(null, e.title + '\n' + description),
      });
    }
    const last = r.edges.at(-1)?.node;
    if (!r.pageInfo.hasNextPage || (last && Date.parse(last.dateTime) >= end)) break;
    after = r.pageInfo.endCursor;
  }
  return out;
}
