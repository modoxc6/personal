// Reads the Obsidian TV Shows + Movies + TTRPG Books notes, writes the collection
// JSON, and resizes every cover into covers/.  Run after adding entries:  node build.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, parse } from 'node:path';

const VAULT = 'D:/Obsidian/Personal';
const OUT = new URL('.', import.meta.url).pathname.replace(/^\//, '');
const WIDTH = 340;

// dir is relative to the vault root — the shelves do not share a parent folder.
const SHELVES = [
  { kind: 'tv',     dir: 'TV and Film/TV Shows', out: 'shows.json',  covers: 'covers/tv' },
  { kind: 'movies', dir: 'TV and Film/Movies',   out: 'movies.json', covers: 'covers/film' },
  { kind: 'ttrpgs', dir: 'TTRPG/TTRPG Books',    out: 'ttrpgs.json', covers: 'covers/ttrpg' },
];

// Every folder carries an index note named after itself; some also carry a CLAUDE.md
// of conventions. Neither is an entry.
const isNote = (file, folder) => {
  const name = parse(file).name;
  return file.endsWith('.md') && name !== folder && name !== 'CLAUDE';
};

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
  const folder = shelf.dir.split('/').pop();
  const notes = readdirSync(join(VAULT, shelf.dir)).filter((f) => isNote(f, folder));

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
      status: one(fm.Status) || (shelf.kind === 'ttrpgs' ? 'Not started' : 'Done'),
      tags: list(fm.tags),
    };

    if (shelf.kind === 'tv') Object.assign(entry, {
      started: one(fm.Started),
      forWhom: one(fm.For),
      season: one(fm.Season),
      service: one(fm.Service),
      links: { TheTVDB: one(fm.TVdb), MyAnimeList: one(fm.MAL) },
    });
    else if (shelf.kind === 'movies') Object.assign(entry, {
      director: one(fm.Director),
      country: one(fm.Country),
      runtime: one(fm.Runtime),
      synopsis: body || null,
      links: { Letterboxd: one(fm.Letterboxd), TMDB: one(fm.TMDB) },
    });
    else Object.assign(entry, {
      game: one(fm.Game),
      system: list(fm.System),
      players: list(fm.Players),
      physical: one(fm.Physical) === 'true',
      played: one(fm.Played) === 'true',
      links: {},
    });

    for (const k of Object.keys(entry.links)) if (!entry.links[k]) delete entry.links[k];
    items.push(entry);
  }

  // TTRPG notes carry no dates at all, so they sort by title — the game-line prefix
  // in each filename is what does the grouping.
  const when = (e) => e.finished || e.started || '';
  if (shelf.kind === 'ttrpgs')
    items.sort((a, b) => a.title.localeCompare(b.title, 'en-GB', { numeric: true }));
  else items.sort((a, b) => when(b).localeCompare(when(a)));
  writeFileSync(join(OUT, shelf.out), JSON.stringify(items));
  console.log(`${shelf.dir}: ${items.length} -> ${shelf.out}`);
}
