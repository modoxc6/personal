const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

const source = readFileSync(join(__dirname, "app.js"), "utf8");
// ponytail: isolate the reset handler; use a DOM harness if reset starts querying it.
const handler = source.slice(source.indexOf("  function resetFilters()"),
  source.indexOf("  function bindEvents()"));
const state = { types: ["Comic", "Manga"], view: "top", query: "Berserk", rating: "4" };
const elements = Object.fromEntries([
  "search", "rating", "viewer", "status", "service", "decade", "country", "game",
  "bookStatus", "players", "physical", "bookStatusMain", "bookFormat", "publisher", "sort",
].map(name => [name, { value: "selected" }]));
let renders = 0;
runInNewContext(handler + "\nresetFilters();", {
  state, elements, config: { defaultSort: "recent" },
  renderTypeChips() { assert.equal(state.types.length, 0); },
  updateResults() { assert.equal(state.types.length, 0); renders++; },
});
assert.equal(state.types.length, 0);
assert.equal(state.view, "all");
assert.equal(state.query, "");
assert.equal(state.rating, "");
assert.equal(state.sort, "recent");
assert.equal(elements.sort.value, "recent");
assert.equal(elements.search.value, "");
assert.equal(renders, 1);
console.log("Books reset regression check passed");
