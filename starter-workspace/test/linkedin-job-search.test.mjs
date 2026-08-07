import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIndeedOptions,
  buildSearchUrl,
  extractTitleTerms,
  extractDivContent,
  matchesRecency,
  matchesTitleQuery,
  matchesWorkMode,
  mergeJobLists,
  normalizeIndeedJob,
  normalizeLocation,
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
      <span class="job-search-card__location">Toronto, Ontario</span>
      <time class="job-search-card__listdate" datetime="2026-07-29"></time>
    </div>
  </li>`;
}

test("search cards decode entities and normalize URLs", () => {
  const [job] = parseJobCards(card("4430123456", "Product &#x26; Visual Designer", "Caf&#233;"));
  assert.equal(job.title, "Product & Visual Designer");
  assert.equal(job.source, "linkedin");
  assert.equal(job.company, "Café");
  assert.equal(job.location, "Toronto, Ontario");
  assert.equal(job.url, "https://www.linkedin.com/jobs/view/4430123456");
});

test("title queries post-filter full-text noise", () => {
  const query =
    '(title:"Content Coordinator" OR title:"Digital Marketing Coordinator")';
  assert.deepEqual(extractTitleTerms(query), [
    "content coordinator",
    "digital marketing coordinator",
  ]);
  assert.equal(
    matchesTitleQuery({ title: "Social Media & Content Coordinator" }, query),
    true,
  );
  assert.equal(matchesTitleQuery({ title: "Sales Manager" }, query), false);
  assert.equal(
    matchesTitleQuery({ title: "Sales Manager" }, "marketing AND SaaS"),
    true,
  );
});

test("Canadian location aliases normalize for cross-source deduplication", () => {
  assert.equal(
    normalizeLocation("Montréal, QC, CA"),
    normalizeLocation("Montreal, Quebec, Canada"),
  );
  assert.equal(
    normalizeLocation("Toronto, ON, CA"),
    normalizeLocation("Toronto, Ontario, Canada"),
  );
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
    "Toronto, Ontario, Canada",
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
        "Toronto, Ontario, Canada",
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
      location: "Toronto, Ontario, Canada",
      jobage: 7,
      remote: "remote",
      page: 2,
    }),
  );
  assert.equal(url.searchParams.get("keywords"), "Product Designer");
  assert.equal(url.searchParams.get("location"), "Toronto, Ontario, Canada");
  assert.equal(url.searchParams.get("f_TPR"), "r604800");
  assert.equal(url.searchParams.get("f_WT"), "2");
  assert.equal(url.searchParams.get("start"), "10");
});

test("Indeed options and fields map into the shared result shape", () => {
  const options = buildIndeedOptions({
    query: "Product Designer",
    location: "Toronto, Ontario, Canada",
    jobage: 3,
    remote: "remote",
    page: 2,
    limit: 10,
  });
  assert.equal(options.countryIndeed, "Canada");
  assert.equal(options.hoursOld, 72);
  assert.equal(options.offset, 10);
  assert.equal(options.resultsWanted, 10);

  const job = normalizeIndeedJob({
    id: "in-abc",
    title: "Junior Product Designer",
    company: "Acme",
    location: "Toronto, ON, CA",
    datePosted: "2026-08-04",
    jobUrl: "https://ca.indeed.com/viewjob?jk=abc",
    jobUrlDirect: "https://acme.example/jobs/abc",
    description: "Remote role with 0-2 years of experience.",
    jobType: "fulltime",
    isRemote: true,
  });
  assert.equal(job.source, "indeed");
  assert.equal(job.date, "2026-08-04");
  assert.equal(job.applyUrl, "https://acme.example/jobs/abc");
  assert.match(job.description, /0-2 years/);
  assert.equal(matchesWorkMode(job, "remote"), true);
  assert.equal(
    matchesWorkMode(
      { ...job, isRemote: false, description: "Hybrid role" },
      "hybrid",
    ),
    true,
  );
  assert.equal(
    matchesWorkMode(
      { ...job, isRemote: false, description: "Onsite role" },
      "onsite",
    ),
    true,
  );
  assert.equal(
    matchesRecency(job.date, 3, new Date("2026-08-04T18:00:00Z")),
    true,
  );
  assert.equal(
    matchesRecency("2026-07-30", 3, new Date("2026-08-04T18:00:00Z")),
    false,
  );
});

test("combined results alternate sources, deduplicate, and honor the total limit", () => {
  const duplicate = {
    id: "li-1",
    source: "linkedin",
    title: "Junior Product Designer",
    company: "Acme",
    location: "Toronto, Ontario, Canada",
  };
  const indeed = {
    ...duplicate,
    id: "in-1",
    source: "indeed",
    location: "Toronto, ON, CA",
    description: "Full JD",
  };
  const linkedinOnly = {
    id: "li-2",
    source: "linkedin",
    title: "UX Designer",
    company: "Beta",
    location: "Ottawa, ON, CA",
  };
  const jobs = mergeJobLists([[indeed], [duplicate, linkedinOnly]], 2);
  assert.deepEqual(jobs.map((job) => job.source), ["indeed", "linkedin"]);
  assert.deepEqual(jobs.map((job) => job.id), ["in-1", "li-2"]);
});
