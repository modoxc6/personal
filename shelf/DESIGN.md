# Design - The Shelf

The Shelf is a fast poster-led archive generated from Rich's Obsidian vault.
Television and movies share one interface and differ only in their collection
accent and collection-specific filters.

## Collections

| Collection | URL | Accent |
|---|---|---|
| Television | `?collection=tv` | Ember `#f59a56` |
| Movies | `?collection=movies` | Moss `#74d58b` |

The collection switch is a real link near the top of the page. The selected
collection is the only JSON file requested at startup.

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
