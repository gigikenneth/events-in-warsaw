# Events in Warsaw

Every public event in Warsaw from Luma, Meetup, Eventbrite and Resident Advisor in one calendar, with an English filter for English speakers. Also served as a calendar feed you can subscribe to in Google or Apple Calendar.

Live: https://events-in-warsaw.vercel.app · Feed: https://events-in-warsaw.vercel.app/warsaw.ics

## How it works

- `lib/sources/*.js`: one reader per site, each using the public endpoint its own website uses (unofficial, so any of them can break).
- `lib/events.js`: runs all sources in parallel, merges events cross-posted to several sites, assigns topics, builds the `.ics` feed.
- `api/feed.js`: serves `/events.json` (the page) and `/warsaw.ics` (English events only). Cached at the edge for an hour.
- `public/index.html`: the calendar page, no build step.

## Check

```
node check.js
```

Runs the logic self-checks, then a live fetch from every source.
