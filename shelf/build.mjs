// Reads the Obsidian TV Shows + Movies notes, writes shows.json / movies.json,
// and resizes every cover into covers/.  Run after adding entries:  node build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, parse } from 'node:path';

const VAULT = 'D:/Obsidian/Personal/TV and Film';
const OUT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const WIDTH = 340;

const SHELVES = [
  { dir: 'TV Shows', out: 'shows.json', covers: 'covers/tv', skip: 'TV Shows' },
  { dir: 'Movies',   out: 'movies.json', covers: 'covers/film', skip: 'Movies' },
];

// ponytail: the frontmatter is hand-written by one person in one shape —
// scalars and `- ` lists, no nesting, no quotes worth unescaping. A YAML dep
// would be 3MB to parse a dozen keys. Swap it in if the notes ever get nested.
function parseNote(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  const fm = {};
  let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && key) {
      (Array.isArray(fm[key]) ? fm[key] : (fm[key] = [])).push(clean(item[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z][\w ]*):\s*(.*)$/);
    if (!kv) continue;
    key = kv[1];
    fm[key] = kv[2] === '' ? [] : clean(kv[2]);
  }
  return { fm, body: m[2].trim() };
}

const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
const one = (v) => (Array.isArray(v) ? v[0] : v) || null;   // Status is sometimes a 1-item list
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []);
const num = (v) => (one(v) ? Number(one(v)) : null);

function cover(shelf, file, src) {
  if (!src) return null;
  const name = parse(src).name;
  const from = join(VAULT, shelf.dir, 'Covers', src);
  const to = join(OUT, shelf.covers, name + '.jpg');
  if (!existsSync(from)) { console.warn(`missing cover: ${file} -> ${src}`); return null; }
  if (!existsSync(to) || statSync(from).mtimeMs > statSync(to).mtimeMs)
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', from,
      '-vf', `scale=${WIDTH}:-2`, '-q:v', '5', to]);
  return `${shelf.covers}/${name}.jpg`;
}

for (const shelf of SHELVES) {
  mkdirSync(join(OUT, shelf.covers), { recursive: true });
  const notes = readdirSync(join(VAULT, shelf.dir))
    .filter((f) => f.endsWith('.md') && parse(f).name !== shelf.skip);

  const items = [];
  for (const file of notes) {
    const note = parseNote(readFileSync(join(VAULT, shelf.dir, file), 'utf8'));
    if (!note) { console.warn(`no frontmatter: ${file}`); continue; }
    const { fm, body } = note;

    const entry = {
      title: parse(file).name,
      cover: cover(shelf, file, one(fm.Cover)?.replace(/^\[\[|\]\]$/g, '')),
      release: one(fm.Release),
      finished: one(fm.Finished),
      rating: num(fm.Rating),
      status: one(fm.Status) || 'Done',
      tags: list(fm.tags),
    };

    if (shelf.dir === 'TV Shows') Object.assign(entry, {
      started: one(fm.Started),
      forWhom: one(fm.For),
      season: one(fm.Season),
      service: one(fm.Service),
      links: { TheTVDB: one(fm.TVdb), MyAnimeList: one(fm.MAL) },
    });
    else Object.assign(entry, {
      director: one(fm.Director),
      country: one(fm.Country),
      runtime: one(fm.Runtime),
      synopsis: body || null,
      links: { Letterboxd: one(fm.Letterboxd), TMDB: one(fm.TMDB) },
    });

    for (const k of Object.keys(entry.links)) if (!entry.links[k]) delete entry.links[k];
    items.push(entry);
  }

  const when = (e) => e.finished || e.started || '';
  items.sort((a, b) => when(b).localeCompare(when(a)));
  writeFileSync(join(OUT, shelf.out), JSON.stringify(items));
  console.log(`${shelf.dir}: ${items.length} -> ${shelf.out}`);
}
