import { getEvents, toICS } from '../lib/events.js';

// /warsaw.ics -> English events as a calendar feed
// /events.json -> every event with its English flag, for the preview page
export async function GET(request) {
  const json = new URL(request.url).searchParams.get('format') === 'json';
  const events = await getEvents();
  const cache = { 'cache-control': 'public, s-maxage=3600, stale-while-revalidate=86400' };
  if (json) return Response.json({ updated: new Date().toISOString(), events }, { headers: cache });
  return new Response(toICS(events.filter((e) => e.english)), {
    headers: { ...cache, 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="warsaw.ics"' },
  });
}
