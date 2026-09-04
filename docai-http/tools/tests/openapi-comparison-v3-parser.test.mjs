import assert from "node:assert/strict";
import test from "node:test";

import { parseProviderText } from "../openapi-comparison-v3-parser.mjs";

const INVALID_JSON_ERROR = {
  code: "invalid-json",
  message: "Provider response must be one JSON object or one json fence.",
};

test("parses only the permitted complete provider response forms", () => {
  const cases = [
    {
      name: "a raw JSON object",
      text: '{"answer":"ok"}',
      formatStatus: "raw-json",
      contentJson: { answer: "ok" },
      parseError: null,
    },
    {
      name: "a raw JSON object with surrounding whitespace",
      text: " \n\t {\"answer\":true}\n ",
      formatStatus: "raw-json",
      contentJson: { answer: true },
      parseError: null,
    },
    {
      name: "one exact lower-case json fence",
      text: '```json\n{\n  "answer": 1\n}\n```',
      formatStatus: "fenced-json",
      contentJson: { answer: 1 },
      parseError: null,
    },
    {
      name: "a fence with surrounding whitespace",
      text: "\n ```json\n{\"answer\":null}\n``` \t\n",
      formatStatus: "fenced-json",
      contentJson: { answer: null },
      parseError: null,
    },
    {
      name: "prose around a fence",
      text: 'Here is the result:\n```json\n{"answer":"ok"}\n```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "prose around a raw JSON object",
      text: 'Here is the result: {"answer":"ok"}',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "an unlabelled fence",
      text: '```\n{"answer":"ok"}\n```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "an uppercase fence label",
      text: '```JSON\n{"answer":"ok"}\n```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "a fence label with horizontal whitespace",
      text: '```json \n{"answer":"ok"}\n```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "a closing fence with horizontal whitespace",
      text: '```json\n{"answer":"ok"}\n ```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "multiple JSON values",
      text: '{"first":1}\n{"second":2}',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "an array",
      text: '[{"answer":"ok"}]',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "a scalar",
      text: '"ok"',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "malformed JSON",
      text: '{"answer":}',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "truncated JSON",
      text: '{"answer":"ok"',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
    {
      name: "multiple fences",
      text: '```json\n{"first":1}\n```\n```json\n{"second":2}\n```',
      formatStatus: "invalid-json",
      contentJson: null,
      parseError: INVALID_JSON_ERROR,
    },
  ];

  for (const expected of cases) {
    const actual = parseProviderText(expected.text);

    assert.deepEqual(actual, {
      format_status: expected.formatStatus,
      content_json: expected.contentJson,
      content_text: expected.text,
      parse_error: expected.parseError,
    }, expected.name);
    assert.deepEqual(Object.keys(actual), [
      "format_status",
      "content_json",
      "content_text",
      "parse_error",
    ], `${expected.name} returns only the parser contract keys`);
  }
});

test("rejects empty provider text without attempting JSON parsing", () => {
  for (const text of ["", " \n\t "]) {
    assert.deepEqual(parseProviderText(text), {
      format_status: "empty",
      content_json: null,
      content_text: text,
      parse_error: {
        code: "empty",
        message: "Provider response text is empty.",
      },
    });
  }
});

test("preserves incomplete provider text without parsing it", () => {
  const text = '{"answer":"complete-looking"}';

  assert.deepEqual(parseProviderText(text, { incomplete: true }), {
    format_status: "incomplete",
    content_json: null,
    content_text: text,
    parse_error: {
      code: "incomplete",
      message: "Provider response is incomplete; partial text was not parsed.",
    },
  });
});
