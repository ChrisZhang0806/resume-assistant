import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSearchUrl,
  extractDivContent,
  parseCliArgs,
  parseJobCards,
  parseJobDetail,
} from "../scripts/search-linkedin-jobs.mjs";

function card(id, title, company = "Acme") {
  return `<li>
    <div data-entity-urn="urn:li:jobPosting:${id}">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/${id}?tracking=1"></a>
      <h3 class="base-search-card__title">${title}</h3>
      <h4 class="base-search-card__subtitle"><a href="https://www.linkedin.com/company/acme">${company}</a></h4>
      <span class="job-search-card__location">Berlin, Germany</span>
      <time class="job-search-card__listdate" datetime="2026-07-29"></time>
    </div>
  </li>`;
}

test("search cards decode entities and normalize URLs", () => {
  const [job] = parseJobCards(card("4430123456", "Product &#x26; Visual Designer", "Caf&#233;"));
  assert.equal(job.title, "Product & Visual Designer");
  assert.equal(job.company, "Café");
  assert.equal(job.location, "Berlin, Germany");
  assert.equal(job.url, "https://www.linkedin.com/jobs/view/4430123456");
});

test("detail parsing preserves nested description content", () => {
  const html = `<h1 class="topcard__title">Product Designer</h1>
    <div class="description__text">
      <div>Requirements:</div>
      <ul><li>Design complex workflows</li></ul>
      <div>About us:</div>
      <p>We build software.</p>
    </div>`;
  assert.ok(extractDivContent(html, "description__text"));
  const job = parseJobDetail(html, "4430123456");
  assert.match(job.description, /Requirements:/);
  assert.match(job.description, /Design complex workflows/);
  assert.match(job.description, /We build software/);
});

test("search arguments validate low-volume limits", () => {
  const options = parseCliArgs([
    "search",
    "-q",
    "Product Designer",
    "-l",
    "Berlin, Germany",
    "--jobage",
    "7",
    "--remote",
    "hybrid",
    "--limit",
    "10",
  ]);
  assert.equal(options.limit, 10);
  assert.throws(
    () =>
      parseCliArgs([
        "search",
        "-l",
        "Berlin, Germany",
        "--limit",
        "20",
      ]),
    /between 0 and 10/,
  );
});

test("search URL maps recency, workplace, and page filters", () => {
  const url = new URL(
    buildSearchUrl({
      query: "Product Designer",
      location: "Berlin, Germany",
      jobage: 7,
      remote: "remote",
      page: 2,
    }),
  );
  assert.equal(url.searchParams.get("keywords"), "Product Designer");
  assert.equal(url.searchParams.get("location"), "Berlin, Germany");
  assert.equal(url.searchParams.get("f_TPR"), "r604800");
  assert.equal(url.searchParams.get("f_WT"), "2");
  assert.equal(url.searchParams.get("start"), "10");
});
