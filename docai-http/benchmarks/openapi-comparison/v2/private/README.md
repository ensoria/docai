# Private Benchmark Workspace

Files beside this README are intentionally ignored by Git until all nine
primary benchmark batches close. This reduces public training-contamination
risk for the two holdout APIs and prevents partial results from being mistaken
for completed evidence.

Expected local layout:

```text
private/
  holdouts/
    field-service/
    media-processing/
  prompts/
  contexts/
  checkpoints/
  runs/
  adjudication/
```

Keep an access-controlled backup before Live execution. Do not place API keys,
provider account identifiers, billing balances, or unrelated secrets here.
After all batches close, review and redact the artifacts before deliberately
moving publishable evidence out of this ignored directory.

For a completed batch whose review gate is open, follow
`../MANUAL-ADJUDICATION.md`. The generated `review-sheet.md`,
`review-sheet.ja.md`, and `decisions.jsonl` are reviewer-facing. Keep
`DO-NOT-SHARE-review-map.json` concealed until every decision is final.

Require and validate all locally available private packets:

```sh
DOCAI_BENCHMARK_PRIVATE_REQUIRED=1 \
  node --test docai-http/tools/tests/openapi-comparison-v2-private-packets.test.mjs
```
