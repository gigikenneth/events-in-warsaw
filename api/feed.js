import { put, head } from '@vercel/blob';
import { waitUntil } from '@vercel/functions';
import { getEvents, toICS } from '../lib/events.js';

// Serve the last saved snapshot instantly; if it's over an hour old, refresh it
// from every source in the background after responding. Only the very first
// request (no snapshot yet) waits for the live fetch.
const KEY = 'events.json';
const FRESH_MS = 60 * 60e3;

async function readSnapshot() {
  try {
    const { url } = await head(KEY);
    return await fetch(url).then((r) => r.json());
  } catch {
    return null;
  }
}

async function refresh() {
  const { events, status } = await getEvents();
  const snap = { updated: new Date().toISOString(), status, events };
  if (events.length) {
    await put(KEY, JSON.stringify(snap), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json', cacheControlMaxAge: 60,
    });
  }
  return snap;
}

// /warsaw.ics -> English events from every source as a calendar feed
// /events.json -> every event (minus descriptions) for the calendar page
export async function GET(request) {
  let snap = await readSnapshot();
  if (!snap) snap = await refresh();
  else if (Date.now() - Date.parse(snap.updated) > FRESH_MS) waitUntil(refresh().catch((e) => console.error('refresh failed', e)));

  const cache = { 'cache-control': 'public, s-maxage=300, stale-while-revalidate=86400' };
  if (new URL(request.url).searchParams.get('format') === 'json') {
    const events = snap.events.map(({ description, ...e }) => e);
    return Response.json({ ...snap, events }, { headers: cache });
  }
  return new Response(toICS(snap.events.filter((e) => e.english)), {
    headers: { ...cache, 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="warsaw.ics"' },
  });
}
