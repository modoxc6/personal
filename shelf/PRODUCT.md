# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Rich, the owner and only author of the log, is the primary user. He arrives to browse what he has already watched — recalling a title, checking whether a season is logged, seeing what he and his partner watched together — rather than to do data entry. The secondary audience is anyone he sends the link to: friends who watch the same shows, people who ask "what should I watch". They arrive cold, with no explanation, and must understand the page in seconds.

## Product Purpose

A public, shareable page that displays Rich's personal TV log — every season he has watched, is watching, or plans to watch — with the cover art leading and the underlying data (rating, dates, service, tags, who it was for) available to filter and sort against. Success is that browsing it is a pleasure on its own, and that a specific question ("what did we rate 4+ on Netflix last year") can still be answered without leaving the page.

## Positioning

The log is authored, not scraped. Every entry is a note Rich wrote by hand in his Obsidian vault, with a personal 0.5–5 rating, a hand-picked season-specific cover, and personal shorthand tags (`ggp` = a Gundam podcast watch-along, `mech`, `gundam`) that no tracking service would produce. It is a record of one person's actual viewing with its own vocabulary, not a Trakt/Letterboxd profile.

## Operating Context

- Source of truth is `D:\Obsidian\Personal\TV and Film\TV Shows\` — one markdown note per season, YAML frontmatter only, plus a `Covers/` folder of one image per note, filename-matched.
- Data reaches the page via a build script that reads the frontmatter and writes `shows.json` + copies covers. Rich runs it after adding shows; the published page is static.
- The page is a sub-route of the existing GitHub Pages site `modoxc6/personal` (`https://modoxc6.github.io/personal/`), whose index is a card hub linking to standalone project pages. Sub-pages do not inherit the hub's visual identity.
- Rich has an existing publishing pattern: push to `main`, Pages serves it.

## Capabilities and Constraints

- Static site: no server, no build framework required, no external network calls at runtime.
- Current corpus: 89 season notes, 88 covers.
- Fields present per entry, all optional except the title: `Cover`, `Release` (first-aired date), `TVdb` / `MAL` URLs, `tags` (freeform list), `Started`, `Finished`, `For` (`Me` | `Us`), `Rating` (0.5–5 in half steps), `Season` (`S1`, `S1-2`, or absent), `Service`, `Status` (`Done` | `In Progress` | `Abandoned`, occasionally written as a one-item list).
- Real distribution today: 84 Done, 3 In Progress, 1 Abandoned; 40 `Me` / 39 `Us`; 4 entries with no rating, 6 with no service; ratings cluster hard at 3–4.5. Any design must survive a corpus that is overwhelmingly one status.
- Tag vocabulary is long-tailed and inconsistent: `drama` (53) down to single-use tags like `cgi`, `historical`. 32 entries carry `ggp`.
- Multi-season shows are separate entries with near-identical metadata (e.g. `Apothecary Diaries S1` / `S2`); the design must not read as duplicates.
- Titles use curly apostrophes and spaced ` - ` subtitle separators.

## Brand Commitments

None binding. The parent hub uses a zine/riso look, but sub-pages of `modoxc6/personal` are independently designed and this page is not required to inherit it. Rich has asked for a dark theme.

## Evidence on Hand

- 89 real notes with real ratings and dates at `D:\Obsidian\Personal\TV and Film\TV Shows\*.md`.
- 88 real cover images at `.../TV Shows/Covers/`.
- Real external links (TheTVDB, MyAnimeList) per entry.
- No synthetic entries are needed or permitted — the whole corpus is real. Nothing about viewing counts, episode counts, or watch time exists in the data and must not be fabricated.

## Product Principles

1. The covers are the content. Anything that pushes them below metadata has inverted the page.
2. Every displayed number comes from a note. No derived statistics that imply data the vault does not hold.
3. A stranger must be able to read the page without a legend; a personal tag like `ggp` may stay opaque but must not be load-bearing for comprehension.
4. Filtering is a tool, not the frame. It must be reachable instantly and invisible when unused.
5. The vault stays the source of truth. The page is generated, never hand-edited.

## Accessibility & Inclusion

No product-specific standard established. Standard expectations apply: keyboard-operable filters, visible focus, non-color-only status encoding, reduced-motion respected.
