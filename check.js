// node check.js: language filter self-check, then a live run against Luma
import assert from 'node:assert';
import { isEnglish, getEvents, toICS } from './lib/events.js';
assert(isEnglish('pl', 'Join us for an evening of talks about AI safety and what we can do with you'));
assert(!isEnglish('en', 'Zapraszamy na spotkanie w Warszawie, będzie to wieczór dla wszystkich którzy chcą się poznać i porozmawiać o tym'));
assert(isEnglish('en', 'Finance Operators'));
assert(!isEnglish('ru', 'Мастермайнд'));
const ev = await getEvents();
const en = ev.filter((e) => e.english);
console.log(`${ev.length} events, ${en.length} English, ${ev.at(-1)?.start.slice(0, 10)} last`);
for (const e of ev) console.log(e.english ? 'EN' : '  ', e.locale.padEnd(2), e.start.slice(0, 10), e.name.slice(0, 60));
const ics = toICS(en);
assert(ics.startsWith('BEGIN:VCALENDAR') && ics.split('BEGIN:VEVENT').length - 1 === en.length);
console.log('ok');
