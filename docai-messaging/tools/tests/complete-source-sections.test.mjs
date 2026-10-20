import assert from "node:assert/strict";
import test from "node:test";
import { extractSourceSection } from "../lib/complete-source-sections.mjs";

test("source section preserves fenced identity data and excludes the actual trailer", () => {
  const body = ["Retained content.", "", "##### x-Audit", "", "````text",
    "> docai-identity: literal-data", "```", "### Reply", "````"].join("\n");
  const text = ["## SEND events (operation)", "", "### Behavior", "", body,
    "", "> docai-identity: actual-trailer", ""].join("\n");
  assert.equal(extractSourceSection(text, "### Behavior"), body);
});

test("source section ignores an earlier fenced matching heading and stops at a real sibling", () => {
  const text = ["## SEND first (first)", "", "```text", "## SEND second (second)",
    "fake purpose", "```", "", "## SEND second (second)", "", "True purpose.",
    "", "## SEND third (third)", "", "Not second's content."].join("\n");
  assert.equal(extractSourceSection(text, "## SEND second (second)"), "True purpose.");
});

test("source section rejects unavailable or malformed section inputs without throwing", () => {
  for (const text of [undefined, null, "## Other\n\nnone", "## Target\n\n```text\nnot closed"]) {
    assert.equal(extractSourceSection(text, "## Target"), null);
  }
});
