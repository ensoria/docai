# OpenAPI Baseline Run Records

This directory is reserved for OpenAPI comparison live-run records.

Do not put these records under `../../runs/`; those files are DocAI HTTP complete-candidate evaluation evidence. OpenAPI baseline records are comparative adoption evidence only.

Each non-example `*.jsonl` file is checked by:

```sh
node docai-http/tools/check-openapi-comparison.mjs
```

Run IDs use:

```text
openapi-<condition>__<target-id>__<task-id>
```

where `<condition>` is one of:

- `raw`
- `sliced`
- `enriched`

Recommended filenames:

- `raw.jsonl`
- `sliced.jsonl`
- `enriched.jsonl`

Provider runners write to those files automatically:

```sh
node docai-http/tools/run-google-openapi-comparison.mjs all --condition raw --target google-stable-agentic
node docai-http/tools/run-anthropic-openapi-comparison.mjs all --condition raw --target anthropic-balanced
node docai-http/tools/run-openai-openapi-comparison.mjs all --condition raw --target openai-frontier
```

Run one condition at a time to keep cost and review scope bounded. Repeat with `--condition sliced` and `--condition enriched` only after the previous condition's records pass the checker.

The checker accepts partial run files so provider runs can be reviewed incrementally. Complete every required target/task record for a condition before treating that condition as comparable evidence.
