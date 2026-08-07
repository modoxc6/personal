(() => {
  "use strict";

  const BATCH_SIZE = 48;
  const collator = new Intl.Collator("en-GB", { sensitivity: "base", numeric: true });
  const params = new URLSearchParams(window.location.search);

  const COLLECTIONS = {
    tv: {
      file: "shows.json",
      title: "Television",
      noun: "seasons",
      dialogLabel: "TV log entry",
      defaultSort: "recent",
      searchHint: "Title, tag or service",
      views: [
        ["all", "All"],
        ["watching", "Watching now"],
        ["recent", "Most recent"],
        ["top", "Top rated"],
        ["anime", "Anime"],
      ],
    },
    movies: {
      file: "movies.json",
      title: "Movies",
      noun: "films",
      dialogLabel: "Movie log entry",
      defaultSort: "recent",
      searchHint: "Title, tag or director",
      views: [
        ["all", "All"],
        ["recent", "Most recent"],
        ["top", "Top rated"],
        ["documentary", "Documentaries"],
        ["horror", "Horror"],
      ],
    },
    ttrpgs: {
      file: "ttrpgs.json",
      title: "TTRPGs",
      noun: "books",
      dialogLabel: "TTRPG book",
      // No date is recorded for these, so alphabetical is the only meaningful default.
      defaultSort: "title",
      dated: false,
      searchHint: "Title, game or tag",
      views: [
        ["all", "All"],
        ["reading", "Reading now"],
        ["next", "Up next"],
        ["top", "Top rated"],
        ["solo", "Solo"],
        ["duo", "Duo"],
        ["group", "Group"],
        ["cthulhu", "Cthulhu"],
        ["dnd", "D&D"],
        ["cyberpunk", "Cyberpunk"],
        ["backed", "Backed"],
        ["played", "Played"],
      ],
    },
  };

  const collection = COLLECTIONS[params.get("collection")] ? params.get("collection") : "tv";
  const config = COLLECTIONS[collection];

  const state = {
    view: params.get("view") || "all",
    query: params.get("q") || "",
    rating: params.get("rating") || "",
    viewer: params.get("viewer") || "",
    status: params.get("status") || "",
    service: params.get("service") || "",
    decade: params.get("decade") || "",
    country: params.get("country") || "",
    game: params.get("game") || "",
    players: params.get("players") || "",
    physical: params.get("format") || "",
    tag: params.get("tag") || "",
    sort: params.get("sort") || config.defaultSort,
  };

  const elements = {
    body: document.body,
    pageTitle: document.querySelector("#page-title"),
    collectionLinks: [...document.querySelectorAll("[data-collection-link]")],
    views: document.querySelector("#suggested-views"),
    panel: document.querySelector("#filter-panel"),
    filterToggle: document.querySelector("#filter-toggle"),
    filterToggleCount: document.querySelector("#filter-toggle-count"),
    search: document.querySelector("#filter-search"),
    rating: document.querySelector("#filter-rating"),
    viewer: document.querySelector("#filter-viewer"),
    status: document.querySelector("#filter-status"),
    service: document.querySelector("#filter-service"),
    decade: document.querySelector("#filter-decade"),
    country: document.querySelector("#filter-country"),
    game: document.querySelector("#filter-game"),
    bookStatus: document.querySelector("#filter-book-status"),
    players: document.querySelector("#filter-players"),
    physical: document.querySelector("#filter-physical"),
    sort: document.querySelector("#filter-sort"),
    tvFilters: [...document.querySelectorAll("[data-tv-filter]")],
    movieFilters: [...document.querySelectorAll("[data-movie-filter]")],
    ttrpgFilters: [...document.querySelectorAll("[data-ttrpg-filter]")],
    datedSortOptions: [...document.querySelectorAll("#filter-sort [data-dated-only]")],
    tagList: document.querySelector("#tag-list"),
    showAllTags: document.querySelector("#show-all-tags"),
    reset: document.querySelector("#reset-filters"),
    emptyReset: document.querySelector("#empty-reset"),
    resultCount: document.querySelector("#result-count"),
    grid: document.querySelector("#poster-grid"),
    loading: document.querySelector("#loading-grid"),
    empty: document.querySelector("#empty-state"),
    error: document.querySelector("#error-state"),
    errorMessage: document.querySelector("#error-message"),
    retry: document.querySelector("#retry-load"),
    sentinel: document.querySelector("#load-sentinel"),
    dialog: document.querySelector("#details-dialog"),
    dialogLabel: document.querySelector("#dialog-label"),
    dialogClose: document.querySelector("#dialog-close"),
    detailCover: document.querySelector("#detail-cover"),
    detailTitle: document.querySelector("#detail-title"),
    detailRating: document.querySelector("#detail-rating"),
    detailFields: document.querySelector("#detail-fields"),
    detailSynopsis: document.querySelector("#detail-synopsis"),
    detailTags: document.querySelector("#detail-tags"),
    detailLinks: document.querySelector("#detail-links"),
  };

  let items = [];
  let results = [];
  let renderedCount = 0;
  let latestYear = "";
  let lastDialogTrigger = null;

  function text(value) {
    return value == null ? "" : String(value);
  }

  // Diacritics are stripped so "mork" finds MÖRK BORG and "motstandare" finds Motståndare.
  function normalized(value) {
    return text(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("en-GB");
  }

  function values(source, field) {
    return [...new Set(source.map((item) => text(item[field])).filter(Boolean))]
      .sort((a, b) => collator.compare(a, b));
  }

  function ratingLabel(value) {
    return value == null ? "Not rated" : `${value} / 5`;
  }

  function formatDate(value) {
    if (!value) return "Not logged";
    const isoDate = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!isoDate) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T12:00:00`));
  }

  function yearOf(value) {
    return text(value).slice(0, 4);
  }

  function decadeOf(value) {
    const year = Number(yearOf(value));
    return Number.isFinite(year) && year > 0 ? `${Math.floor(year / 10) * 10}s` : "";
  }

  function statusLabel(item) {
    if (item.status === "In Progress") return "In progress";
    if (collection === "ttrpgs") return item.status || "Not started";
    if (item.status === "Abandoned") return "Abandoned";
    return item.finished ? `Finished ${yearOf(item.finished)}` : "Finished";
  }

  function itemSearchText(item) {
    return normalized([
      item.title,
      item.director,
      item.country,
      item.service,
      item.forWhom,
      item.game,
      ...(item.system || []),
      ...(item.tags || []),
    ].filter(Boolean).join(" "));
  }

  function setupPage() {
    elements.body.dataset.collection = collection;
    document.title = `${config.title} | The Shelf`;
    elements.pageTitle.textContent = config.title;
    elements.pageTitle.dataset.wordmark = config.title;
    elements.dialogLabel.textContent = config.dialogLabel;

    elements.collectionLinks.forEach((link) => {
      const isCurrent = link.dataset.collectionLink === collection;
      if (isCurrent) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    elements.tvFilters.forEach((field) => { field.hidden = collection !== "tv"; });
    elements.movieFilters.forEach((field) => { field.hidden = collection !== "movies"; });
    elements.ttrpgFilters.forEach((field) => { field.hidden = collection !== "ttrpgs"; });

    // "Most recently finished" and "Release date" need dates this shelf does not have.
    const dated = config.dated !== false;
    elements.datedSortOptions.forEach((option) => { option.hidden = !dated; option.disabled = !dated; });
    if (!dated && elements.datedSortOptions.some((option) => option.value === state.sort))
      state.sort = config.defaultSort;

    elements.search.placeholder = config.searchHint;

    const validViews = new Set(config.views.map(([value]) => value));
    if (!validViews.has(state.view)) state.view = "all";

    elements.views.replaceChildren(...config.views.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = value;
      button.textContent = label;
      button.setAttribute("aria-pressed", String(state.view === value));
      return button;
    }));

    elements.search.value = state.query;
    elements.rating.value = state.rating;
    elements.sort.value = state.sort;
  }

  function fillSelect(select, options, current, firstLabel) {
    const fragment = document.createDocumentFragment();
    const first = document.createElement("option");
    first.value = "";
    first.textContent = firstLabel;
    fragment.append(first);

    options.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      fragment.append(option);
    });

    select.replaceChildren(fragment);
    select.value = options.includes(current) ? current : "";
  }

  function setupFilters() {
    if (collection === "tv") {
      fillSelect(elements.viewer, values(items, "forWhom"), state.viewer, "Anyone");
      fillSelect(elements.status, values(items, "status"), state.status, "Any status");
      fillSelect(elements.service, values(items, "service"), state.service, "Any service");
    } else if (collection === "movies") {
      const decades = [...new Set(items.map((item) => decadeOf(item.release)).filter(Boolean))]
        .sort((a, b) => b.localeCompare(a));
      fillSelect(elements.decade, decades, state.decade, "Any decade");
      fillSelect(elements.country, values(items, "country"), state.country, "Any country");
    } else {
      const players = [...new Set(items.flatMap((item) => item.players || []))]
        .sort((a, b) => collator.compare(a, b));
      fillSelect(elements.game, values(items, "game"), state.game, "Any game");
      fillSelect(elements.bookStatus, values(items, "status"), state.status, "Any status");
      fillSelect(elements.players, players, state.players, "Any group size");
      elements.physical.value = state.physical;
    }

    const tagCounts = new Map();
    items.forEach((item) => {
      (item.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1));
    });

    const orderedTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || collator.compare(a[0], b[0]));

    const allButton = tagButton("", "All", items.length, false);
    const buttons = orderedTags.map(([tag, count], index) => tagButton(tag, tag, count, index >= 11));
    elements.tagList.replaceChildren(allButton, ...buttons);
  }

  function tagButton(value, label, count, overflow) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-button";
    button.dataset.tag = value;
    if (overflow) button.dataset.overflow = "true";
    button.setAttribute("aria-pressed", String(state.tag === value));
    button.append(document.createTextNode(`${label} `));
    const countNode = document.createElement("span");
    countNode.textContent = count;
    button.append(countNode);
    return button;
  }

  function matchesView(item) {
    if (state.view === "watching") return item.status === "In Progress";
    if (state.view === "reading") return item.status === "In Progress";
    if (state.view === "next") return item.status === "Next";
    if (state.view === "solo") return (item.players || []).includes("Solo");
    if (state.view === "duo") return (item.players || []).includes("Duo");
    if (state.view === "group") return (item.players || []).includes("Group");
    if (state.view === "cthulhu") return item.game === "Call of Cthulhu";
    if (state.view === "dnd") return item.game === "D&D";
    // Covers both Cyberpunk 2020 and Cyberpunk RED.
    if (state.view === "cyberpunk") return text(item.game).startsWith("Cyberpunk");
    if (state.view === "backed") return (item.tags || []).includes("backed");
    if (state.view === "played") return item.played === true;
    if (state.view === "top") return item.rating != null && item.rating >= 4.5;
    if (state.view === "anime") return (item.tags || []).includes("anime");
    if (state.view === "documentary") return (item.tags || []).includes("documentary");
    if (state.view === "horror") return (item.tags || []).includes("horror");
    if (state.view === "recent") return yearOf(item.finished) === latestYear;
    return true;
  }

  function matches(item) {
    if (!matchesView(item)) return false;
    if (state.query && !item._search.includes(normalized(state.query))) return false;
    if (state.rating && (item.rating == null || item.rating < Number(state.rating))) return false;
    if (state.tag && !(item.tags || []).includes(state.tag)) return false;

    if (collection === "tv") {
      if (state.viewer && item.forWhom !== state.viewer) return false;
      if (state.status && item.status !== state.status) return false;
      if (state.service && item.service !== state.service) return false;
    } else if (collection === "movies") {
      if (state.decade && decadeOf(item.release) !== state.decade) return false;
      if (state.country && item.country !== state.country) return false;
    } else {
      if (state.game && item.game !== state.game) return false;
      if (state.status && item.status !== state.status) return false;
      if (state.players && !(item.players || []).includes(state.players)) return false;
      if (state.physical === "physical" && !item.physical) return false;
      if (state.physical === "played" && !item.played) return false;
    }

    return true;
  }

  function compareItems(a, b) {
    if (state.sort === "rating") {
      return (b.rating ?? -1) - (a.rating ?? -1)
        || collator.compare(a.title, b.title);
    }
    if (state.sort === "title") return collator.compare(a.title, b.title);
    if (state.sort === "release") {
      return text(b.release).localeCompare(text(a.release))
        || collator.compare(a.title, b.title);
    }
    const aDate = a.finished || a.started || "";
    const bDate = b.finished || b.started || "";
    return text(bDate).localeCompare(text(aDate))
      || collator.compare(a.title, b.title);
  }

  function updateResults() {
    results = items.filter(matches).sort(compareItems);
    renderedCount = 0;
    elements.grid.replaceChildren();
    elements.empty.hidden = results.length > 0;
    elements.sentinel.hidden = results.length === 0;
    elements.resultCount.textContent = `${results.length} ${results.length === 1 ? config.noun.slice(0, -1) : config.noun}`;
    appendBatch();
    updateActiveControls();
    updateUrl();
  }

  function appendBatch() {
    if (renderedCount >= results.length) {
      elements.sentinel.hidden = true;
      return;
    }

    const nextItems = results.slice(renderedCount, renderedCount + BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    nextItems.forEach((item, index) => fragment.append(createCard(item, renderedCount + index)));
    elements.grid.append(fragment);
    renderedCount += nextItems.length;
    elements.sentinel.hidden = renderedCount >= results.length;
  }

  function createCard(item, cardIndex) {
    const article = document.createElement("article");
    article.className = "poster-card";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "poster-trigger";
    button.dataset.title = item.title;
    button.setAttribute("aria-label", `Open details for ${item.title}`);
    button.addEventListener("click", () => openDialog(item, button));

    const frame = document.createElement("div");
    frame.className = "poster-frame";

    if (item.cover) {
      const image = document.createElement("img");
      image.src = item.cover;
      image.alt = `${item.title} cover`;
      image.loading = cardIndex < 10 ? "eager" : "lazy";
      image.decoding = "async";
      if (cardIndex === 0) image.fetchPriority = "high";
      image.width = 340;
      image.height = collection === "ttrpgs" ? 476 : 510;   // book frames are 1:1.4, posters 2:3
      image.addEventListener("error", () => image.classList.add("is-missing"), { once: true });
      frame.append(image);
    }

    const copy = document.createElement("div");
    copy.className = "poster-copy";

    const title = document.createElement("p");
    title.className = "poster-title";
    title.textContent = item.title;

    const meta = document.createElement("p");
    meta.className = "poster-meta";
    const pieces = [statusLabel(item), ratingLabel(item.rating)];
    meta.textContent = pieces.join(" · ");

    copy.append(title, meta);
    button.append(frame, copy);
    article.append(button);
    return article;
  }

  function field(label, value) {
    if (!value) return null;
    const wrapper = document.createElement("div");
    wrapper.className = "detail-field";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value;
    wrapper.append(term, description);
    return wrapper;
  }

  function openDialog(item, trigger) {
    lastDialogTrigger = trigger;
    elements.detailTitle.textContent = item.title;
    elements.detailRating.textContent = ratingLabel(item.rating);

    if (item.cover) {
      elements.detailCover.src = item.cover;
      elements.detailCover.alt = `${item.title} cover`;
      elements.detailCover.hidden = false;
    } else {
      elements.detailCover.removeAttribute("src");
      elements.detailCover.alt = "";
      elements.detailCover.hidden = true;
    }

    const fieldsByCollection = {
      tv: () => [
        field("Status", item.status || "Done"),
        field("For", item.forWhom),
        field("Service", item.service),
        field("Released", formatDate(item.release)),
        field("Started", item.started ? formatDate(item.started) : ""),
        field("Finished", item.finished ? formatDate(item.finished) : ""),
        field("Season", item.season),
      ],
      movies: () => [
        field("Director", item.director),
        field("Released", text(item.release)),
        field("Country", item.country),
        field("Runtime", item.runtime),
        field("Finished", item.finished ? formatDate(item.finished) : ""),
        field("Status", item.status || "Done"),
      ],
      ttrpgs: () => [
        field("Status", item.status || "Not started"),
        field("Game", item.game),
        field("System", (item.system || []).join(", ")),
        field("Players", (item.players || []).join(", ")),
        field("Format", item.physical ? "Print" : "PDF"),
        field("Played", item.played ? "Yes" : ""),
      ],
    };

    const fields = fieldsByCollection[collection]();

    elements.detailFields.replaceChildren(...fields.filter(Boolean));

    const synopsis = text(item.synopsis);
    elements.detailSynopsis.textContent = synopsis;
    elements.detailSynopsis.hidden = !synopsis;

    elements.detailTags.replaceChildren(...(item.tags || []).map((tag) => {
      const span = document.createElement("span");
      span.textContent = tag;
      return span;
    }));

    const links = Object.entries(item.links || {}).map(([label, url]) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.textContent = label;
      return anchor;
    });
    elements.detailLinks.replaceChildren(...links);

    elements.dialog.showModal();
    elements.dialogClose.focus();
  }

  function closeDialog() {
    elements.dialog.close();
  }

  function updateActiveControls() {
    elements.views.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
    });

    elements.tagList.querySelectorAll(".tag-button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.tag === state.tag));
    });

    const activeFilters = [
      state.view !== "all",
      Boolean(state.query),
      Boolean(state.rating),
      Boolean(state.viewer),
      Boolean(state.status),
      Boolean(state.service),
      Boolean(state.decade),
      Boolean(state.country),
      Boolean(state.game),
      Boolean(state.players),
      Boolean(state.physical),
      Boolean(state.tag),
      state.sort !== config.defaultSort,
    ].filter(Boolean).length;

    elements.filterToggleCount.textContent = `${activeFilters} active`;
  }

  function updateUrl() {
    const next = new URLSearchParams();
    next.set("collection", collection);
    if (state.view !== "all") next.set("view", state.view);
    if (state.query) next.set("q", state.query);
    if (state.rating) next.set("rating", state.rating);
    if (state.viewer) next.set("viewer", state.viewer);
    if (state.status) next.set("status", state.status);
    if (state.service) next.set("service", state.service);
    if (state.decade) next.set("decade", state.decade);
    if (state.country) next.set("country", state.country);
    if (state.game) next.set("game", state.game);
    if (state.players) next.set("players", state.players);
    if (state.physical) next.set("format", state.physical);
    if (state.tag) next.set("tag", state.tag);
    if (state.sort !== config.defaultSort) next.set("sort", state.sort);
    history.replaceState(null, "", `${location.pathname}?${next.toString()}`);
  }

  function resetFilters() {
    Object.assign(state, {
      view: "all",
      query: "",
      rating: "",
      viewer: "",
      status: "",
      service: "",
      decade: "",
      country: "",
      game: "",
      players: "",
      physical: "",
      tag: "",
      sort: config.defaultSort,
    });

    elements.search.value = "";
    elements.rating.value = "";
    elements.viewer.value = "";
    elements.status.value = "";
    elements.service.value = "";
    elements.decade.value = "";
    elements.country.value = "";
    elements.game.value = "";
    elements.bookStatus.value = "";
    elements.players.value = "";
    elements.physical.value = "";
    elements.sort.value = config.defaultSort;
    updateResults();
  }

  function bindEvents() {
    elements.views.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (!button) return;
      state.view = button.dataset.view;
      updateResults();
    });

    elements.tagList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-tag]");
      if (!button) return;
      state.tag = button.dataset.tag;
      updateResults();
    });

    elements.search.addEventListener("input", () => {
      state.query = elements.search.value.trim();
      updateResults();
    });

    elements.rating.addEventListener("change", () => {
      state.rating = elements.rating.value;
      updateResults();
    });

    elements.viewer.addEventListener("change", () => {
      state.viewer = elements.viewer.value;
      updateResults();
    });

    elements.status.addEventListener("change", () => {
      state.status = elements.status.value;
      updateResults();
    });

    elements.service.addEventListener("change", () => {
      state.service = elements.service.value;
      updateResults();
    });

    elements.decade.addEventListener("change", () => {
      state.decade = elements.decade.value;
      updateResults();
    });

    elements.country.addEventListener("change", () => {
      state.country = elements.country.value;
      updateResults();
    });

    elements.game.addEventListener("change", () => {
      state.game = elements.game.value;
      updateResults();
    });

    elements.bookStatus.addEventListener("change", () => {
      state.status = elements.bookStatus.value;
      updateResults();
    });

    elements.players.addEventListener("change", () => {
      state.players = elements.players.value;
      updateResults();
    });

    elements.physical.addEventListener("change", () => {
      state.physical = elements.physical.value;
      updateResults();
    });

    elements.sort.addEventListener("change", () => {
      state.sort = elements.sort.value;
      updateResults();
    });

    elements.reset.addEventListener("click", resetFilters);
    elements.emptyReset.addEventListener("click", resetFilters);
    elements.retry.addEventListener("click", load);

    elements.showAllTags.addEventListener("click", () => {
      const expanded = !elements.tagList.classList.contains("is-expanded");
      elements.tagList.classList.toggle("is-expanded", expanded);
      elements.showAllTags.setAttribute("aria-expanded", String(expanded));
      elements.showAllTags.textContent = expanded ? "Show fewer" : "Show all";
    });

    elements.filterToggle.addEventListener("click", () => {
      const open = !elements.panel.classList.contains("is-open");
      elements.panel.classList.toggle("is-open", open);
      elements.filterToggle.setAttribute("aria-expanded", String(open));
    });

    elements.dialogClose.addEventListener("click", closeDialog);
    elements.dialog.addEventListener("click", (event) => {
      if (event.target === elements.dialog) closeDialog();
    });
    elements.dialog.addEventListener("close", () => {
      if (lastDialogTrigger) lastDialogTrigger.focus();
    });

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) appendBatch();
    }, { rootMargin: "900px 0px" });
    observer.observe(elements.sentinel);
  }

  async function load() {
    elements.loading.hidden = false;
    elements.error.hidden = true;
    elements.empty.hidden = true;
    elements.grid.replaceChildren();
    elements.resultCount.textContent = "Loading titles...";

    try {
      const response = await fetch(config.file);
      if (!response.ok) throw new Error(`The server returned ${response.status}.`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("The collection data is not an array.");

      items = data.map((item) => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : [],
        _search: itemSearchText(item),
      }));

      latestYear = items
        .map((item) => yearOf(item.finished))
        .filter(Boolean)
        .sort()
        .at(-1) || "";

      setupFilters();
      updateResults();
    } catch (error) {
      elements.errorMessage.textContent = error instanceof Error ? error.message : "Please try again.";
      elements.error.hidden = false;
      elements.resultCount.textContent = "Unavailable";
    } finally {
      elements.loading.hidden = true;
    }
  }

  setupPage();
  bindEvents();
  load();
})();
