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

The checker accepts partial run files so provider runs can be reviewed incrementally. Complete every required target/task record for a condition before treating that condition as comparable evidence.
