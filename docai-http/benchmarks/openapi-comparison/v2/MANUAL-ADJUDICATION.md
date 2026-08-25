# Manual Adjudication Procedure

This procedure covers the single-reviewer, condition-blinded secondary review
of automatically inconclusive OpenAPI comparison benchmark v2 records. It does
not replace or rewrite the automatic primary outcome.

## Scope

- Review only records whose automatic status is `inconclusive` and whose
  `manual_review_required` flag is true.
- Do not manually reclassify `pass`, `fail`, `blocked`, or `malformed` records.
- Do not use adjudicated labels as the preregistered automated pass rate.
- Report that one reviewer was used and that inter-rater agreement was not
  measured.

## Blinding

The review packet removes documentation condition, provider, model, original
run ID, and deterministic schedule position. Exact documentation-format and
provider names found in model output are redacted. The order is deterministically
shuffled.

The reviewer must not open `DO-NOT-SHARE-review-map.json`, the original run
logs, prompt exports, or condition-specific documentation until every decision
is final and the complete checker passes.

`review-sheet.ja.md` is a reviewer-facing Japanese rendering of the same
packet. It translates instructions, labels, and task prose, and retains the
original English task immediately below the translation. Review IDs, case
order, output contracts, expected assertions, model output, and automatic
grader evidence are unchanged.

## Decision Rules

For every case, compare the model output with the authoritative assertions.
Record exactly one decision in `decisions.jsonl`:

- `correct`: the output satisfies the assertions semantically. Equivalent
  wording, concrete placeholder values, and immaterial ordering differences are
  acceptable.
- `incorrect`: at least one substantive assertion is wrong or missing, the
  output invents incompatible behavior, or it cannot perform the requested
  task. Stating uncertainty does not excuse a missing required result.
- `unresolvable`: the packet and assertion rubric do not support a unique
  semantic decision. Use this only for genuine rubric ambiguity, not reviewer
  uncertainty that can be resolved from the packet.

Every non-pending decision requires a concise rationale. Do not change any
other field or file.

## Workflow

Generate or reproduce the packet from the repository root:

```sh
node docai-http/tools/openapi-comparison-v2-adjudication.mjs \
  --batch b01 --write
```

Open the Japanese review sheet and the decision file side by side. The English
sheet remains available for auditing the rendering:

```text
docai-http/benchmarks/openapi-comparison/v2/private/adjudication/2.0.0-frozen.3/b01/review-sheet.ja.md
docai-http/benchmarks/openapi-comparison/v2/private/adjudication/2.0.0-frozen.3/b01/decisions.jsonl
docai-http/benchmarks/openapi-comparison/v2/private/adjudication/2.0.0-frozen.3/b01/review-sheet.md
```

The `review_id` connects each Markdown case to one JSONL decision record. Edit
only `decision` and `rationale` in `decisions.jsonl`.

Check work in progress without requiring all cases to be finished:

```sh
node docai-http/tools/check-openapi-comparison-v2-adjudication.mjs --batch b01
```

After all cases are decided, run the completion gate:

```sh
node docai-http/tools/check-openapi-comparison-v2-adjudication.mjs \
  --batch b01 --require-complete
```

Do not unblind or authorize `b02` until the completion gate passes and the
separate malformed-output stop/go review is recorded.
