# Design - The Shelf

The Shelf is a fast poster-led archive generated from Rich's Obsidian vault.
Collections share one interface and differ only in their accent, their
collection-specific filters, and how their covers are framed.

## Collections

| Collection | URL | Accent | Hue |
|---|---|---|---|
| Television | `?collection=tv` | Ember `#f59a56` | 27° |
| Movies | `?collection=movies` | Moss `#74d58b` | 136° |
| TTRPGs | `?collection=ttrpgs` | Orchid `#d173e8` | 288° |
| Books *(reserved)* | `?collection=books` | Cobalt `#6f9ff0` | 215° |

Four accents, spread as evenly around the wheel as two pre-existing fixed
points allow, at matched lightness and saturation so none dominates. Books is
for fiction and is not built yet: its tokens exist in `styles.css` so the set
is settled, but there is no switch entry until there is data behind it.

The collection switch is a real link near the top of the page. The selected
collection is the only JSON file requested at startup.

## Collection differences

Everything below is the same for every collection except where noted.

- **Filters.** TV filters on viewer, status and service; movies on decade and
  country; TTRPGs on game, reading status, players and format (print / played).
  Rating, search and tags are shared.
- **Sort.** TV and movies default to most recently finished. TTRPG notes carry
  no dates at all, so that shelf defaults to title and hides the two
  date-dependent sort options. Alphabetical is meaningful there because each
  filename is prefixed with its game line.
- **Cover framing.** Posters are `2 / 3` with `object-fit: cover`. RPG book
  covers run 1.19–1.41 and roughly two dozen are landscape, so that shelf uses
  `1 / 1.4` with `object-fit: contain` — cropping would cut the sides off most
  of them and destroy the landscape ones.

## Layout

- Covers lead the page in a responsive poster grid.
- Suggested views sit below the title.
- Filters use a left rail on desktop and a collapsible panel on small screens.
- Tags always follow the other filters.
- Selecting a poster opens a centered native dialog. The page behind it is
  obscured and blurred.
- TV and movie details use the same dialog structure with different field sets.

## Performance contract

- `shows.json` and `movies.json` remain separate.
- The browser renders 48 matching cards initially.
- An `IntersectionObserver` adds the next batch before the visitor reaches it.
- Covers use the existing 340px exports with `loading="lazy"` and
  `decoding="async"`.
- Filtering operates on the in-memory data array, then renders only the first
  batch of matches.
- No framework, font download, database, or runtime API is required.

## Data contract

`build.mjs` reads the Obsidian notes and writes the JSON and cover exports. The
vault remains the only source of truth. Generated data is never hand-edited.

Shelf source folders do not share a parent — TV and film live under
`TV and Film/`, TTRPGs under `TTRPG/` — so each shelf's `dir` is relative to the
vault root. Every source folder contains an index note named after the folder,
and some contain a `CLAUDE.md` of conventions; neither is an entry.
