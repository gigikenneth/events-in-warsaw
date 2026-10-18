// node check.js: logic self-checks, then a live run against every source
import assert from 'node:assert';
import { isEnglish, warsawToISO, keywordTopics } from './lib/util.js';
import { getEvents, toICS, sameEvent } from './lib/events.js';

assert(isEnglish('pl', 'Join us for an evening of talks about AI safety and what we can do with you'));
assert(!isEnglish('en', 'Zapraszamy na spotkanie w Warszawie, będzie to wieczór dla wszystkich którzy chcą się poznać i porozmawiać o tym'));
assert(isEnglish('en', 'Finance Operators'));
assert(!isEnglish('ru', 'Мастермайнд'));
assert(isEnglish(null, 'Intermediate Tango Lesson'));
assert(!isEnglish(null, 'Lekcja tanga argentyńskiego dla osób poniżej 35 lat'));
assert(!isEnglish(null, 'Ролевая Мафия'));
assert.equal(warsawToISO('2026-10-24', '09:30'), '2026-10-24T07:30:00.000Z'); // CEST, UTC+2
assert.equal(warsawToISO('2026-11-27', '10:00'), '2026-11-27T09:00:00.000Z'); // CET, UTC+1
assert.deepEqual(keywordTopics('Warsaw English Stand-Up Comedy: Open Mic'), ['Arts & Culture']);
const ev = (name, start) => ({ name, start });
assert(sameEvent(ev('Mindstone Warsaw October AI Meetup', '2026-10-22T16:00:00Z'), ev('Mindstone Warsaw October AI Meetup', '2026-10-22T16:00:00Z')));
assert(!sameEvent(ev('Mindstone Warsaw October AI Meetup', '2026-10-22T16:00:00Z'), ev('Mindstone Warsaw October AI Meetup', '2026-10-23T16:00:00Z')));
assert(!sameEvent(ev('Warsaw Creative Club: Pierogi Workshop', '2026-11-01T12:00:00Z'), ev('Warsaw Creative Club: All Saints Day Photo Walk', '2026-11-01T12:00:00Z')));

const { events, status } = await getEvents();
console.log('sources', status);
const en = events.filter((e) => e.english);
console.log(`${events.length} events after merge, ${en.length} English, ${events.filter((e) => e.links.length > 1).length} merged`);
for (const e of events.filter((e) => e.links.length > 1)) console.log('  merged:', e.name.slice(0, 50), e.links.map((l) => l.source).join(' + '));
const ics = toICS(en);
assert(ics.startsWith('BEGIN:VCALENDAR') && ics.split('BEGIN:VEVENT').length - 1 === en.length);
const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' });
const keys = events.map((e) => d.format(new Date(e.start)) + e.name);
assert.equal(new Set(keys).size, keys.length, 'duplicate same-day titles');
assert(Object.values(status).every((s) => typeof s === 'number'), 'a source failed');
console.log('ok');
