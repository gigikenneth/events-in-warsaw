export const WARSAW = { lat: 52.2297, lon: 21.0122 };
export const DAYS_AHEAD = 92;
export const until = () => Date.now() + DAYS_AHEAD * 864e5;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

export async function fetchOk(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'user-agent': UA, accept: 'application/json', ...opts.headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r;
}
export const getJSON = (url, opts) => fetchOk(url, opts).then((r) => r.json());
export const postJSON = (url, body, headers = {}) =>
  getJSON(url, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });

export async function mapLimit(items, n, fn) {
  const res = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) { const k = i++; res[k] = await fn(items[k]).catch(() => null); }
  }));
  return res;
}

// Warsaw wall-clock date + time -> UTC ISO string.
export function warsawToISO(date, time = '00:00') {
  const guess = new Date(`${date}T${time}:00Z`);
  const tz = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'shortOffset' })
    .formatToParts(guess).find((p) => p.type === 'timeZoneName').value; // "GMT+1"
  const [, sign, h, m = '0'] = tz.match(/GMT([+-])(\d+)(?::(\d+))?/) || [, '+', '0'];
  const offset = (sign === '-' ? -1 : 1) * (Number(h) * 60 + Number(m));
  return new Date(+guess - offset * 6e4).toISOString();
}

const EN = new Set('the and of for with you your we our will is are this join in at an be from about by us it what how who'.split(' '));
const PL = new Set('i w na z się jest dla oraz do że nie to jak co czy po przez od o ze sa są jako być będzie spotkanie zapraszamy'.split(' '));

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
  if (locale) return locale === 'en';
  // short text, no locale: Latin-only titles read as English; Polish letters, Cyrillic etc. don't
  return (text.match(/[^\x00-\x7F\p{P}\p{S}\s\d]/gu) || []).length <= 1 && all.pl === 0;
}

// Keyword topics for sources without categories, named to match Luma's.
const TOPICS = [
  ['AI', /\b(ai|a\.i\.|llm|gpt|machine learning|ml|agentic|genai|artificial intelligence)\b/i],
  ['Tech', /\b(tech|developer|devops|software|data|cloud|aws|python|java|javascript|startup|founders?|product|ux|cyber|hackathon|coding|programming|sre|web3|blockchain)\b/i],
  ['Music & Nightlife', /\b(dj|techno|house music|party|nightclub|rave|concert|live music|gig|jazz|karaoke)\b/i],
  ['Language Exchange', /\b(language exchange|speaking club|conversation club|tandem|english club|polish club|native speak)/i],
  ['Arts & Culture', /\b(art|museum|gallery|film|cinema|theat(re|er)|comedy|stand-?up|open mic|poetry|writing|book|exhibition|photography|dance)\b/i],
  ['Business', /\b(business|investor|networking|entrepreneur|marketing|sales|finance|career|leadership)\b/i],
  ['Fitness', /\b(running|run club|yoga|volleyball|football|hike|hiking|climbing|cycling|fitness|padel|tennis|sport)\b/i],
  ['Wellness', /\b(wellness|meditation|mindful|breathwork|therapy|holistic|healing)\b/i],
  ['Food & Drink', /\b(food|wine|beer|dinner|brunch|breakfast|cooking|coffee|tasting|pierogi)\b/i],
  ['Games', /\b(board ?games?|games night|quiz|trivia|chess|puzzle|d&d)\b/i],
  ['Social', /\b(social|meet new people|make friends|friending|expat|international|mixer)\b/i],
];
export const TOPIC_NAMES = new Set(TOPICS.map(([t]) => t));
export const keywordTopics = (text) => TOPICS.filter(([, re]) => re.test(text)).map(([t]) => t);

// Plain text from Luma's ProseMirror doc.
export function docText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text;
  if (node.type === 'hard_break') return '\n';
  const inner = (node.content || []).map(docText).join('');
  return ['paragraph', 'heading', 'list_item'].includes(node.type) ? inner + '\n' : inner;
}

export const stripHtml = (s = '') => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+\n/g, '\n').trim();
