import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validatePullRequestBody } from "../src/traceability.js";

const validBody = `## Tracking

- Closes #32

## Acceptance Criteria

- [x] Templates require explicit criteria.

## Definition of Done

- [x] Tests pass.

## Verification

- \`npm run test:unit\`

## Validation Boundaries

- This changes repository process only.
`;

test("accepts a complete pull request contract", () => {
  assert.deepEqual(validatePullRequestBody(validBody), []);
});

test("requires a body and every contract section", () => {
  assert.deepEqual(validatePullRequestBody(null), ["Pull request body is required"]);
  const errors = validatePullRequestBody("## Tracking\n\nCloses #32");
  assert.deepEqual(errors, [
    "Missing section: Acceptance Criteria",
    "Missing section: Definition of Done",
    "Missing section: Verification",
    "Missing section: Validation Boundaries"
  ]);
});

test("requires a Map Room issue link in Tracking rather than an unrelated release-note reference", () => {
  const body = validBody.replace("- Closes #32", "Dependency release notes mention actions/setup-node#1577");
  assert.deepEqual(validatePullRequestBody(body), ["Tracking must link a Map Room issue, for example: Closes #123"]);
});

test("rejects empty or placeholder contract sections", () => {
  const body = validBody
    .replace("- [x] Templates require explicit criteria.", "TODO")
    .replace("- [x] Tests pass.", "N/A")
    .replace("- `npm run test:unit`", "None")
    .replace("- This changes repository process only.", "TBD");
  assert.deepEqual(validatePullRequestBody(body), [
    "Section is empty or still contains a placeholder: Acceptance Criteria",
    "Section is empty or still contains a placeholder: Definition of Done",
    "Section is empty or still contains a placeholder: Verification",
    "Section is empty or still contains a placeholder: Validation Boundaries"
  ]);
});

test("accepts full repository issue references and case-insensitive headings", () => {
  const body = validBody
    .replace("## Tracking", "## TRACKING")
    .replace("Closes #32", "Tracks joshuafuller/map-room#32");
  assert.deepEqual(validatePullRequestBody(body), []);
});

test("rejects the untouched pull request template", async () => {
  const template = await readFile(new URL("../../.github/pull_request_template.md", import.meta.url), "utf8");
  assert.deepEqual(validatePullRequestBody(template), [
    "Tracking must link a Map Room issue, for example: Closes #123",
    "Section is empty or still contains a placeholder: Acceptance Criteria",
    "Section is empty or still contains a placeholder: Definition of Done",
    "Section is empty or still contains a placeholder: Verification",
    "Section is empty or still contains a placeholder: Validation Boundaries"
  ]);
});
