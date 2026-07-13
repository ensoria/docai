# OpenAPI Baseline Evaluation Artifacts

This directory holds OpenAPI comparison artifacts for the complete-candidate evaluation packet.

These files are adoption evidence, not DocAI HTTP conformance evidence. Keep OpenAPI baseline records separate from `../runs/*.jsonl` so they do not change the DocAI HTTP complete-candidate publication gate.

## Prompt Export

Generate OpenAPI baseline prompt records from the repository root:

```sh
node docai-http/tools/build-openapi-comparison-prompts.mjs all --condition all --summary
node docai-http/tools/build-openapi-comparison-prompts.mjs request_construction --condition raw
node docai-http/tools/build-openapi-comparison-prompts.mjs workflow_completion --condition enriched --target openai-frontier
```

Supported conditions:

- `raw`: the complete source OpenAPI YAML as authored.
- `sliced`: only the mapped OpenAPI paths, schemas, webhooks, and workflow extension blocks for the task.
- `enriched`: the sliced OpenAPI context plus selected authoritative Markdown behavior notes used as an enrichment proxy for source facts not expressed in raw OpenAPI.

The prompts reuse the existing complete-candidate evaluation tasks and output contracts without including `expected_outcome`.

The `sliced` condition is fixture-mapped for this comparison corpus. It is not a general OpenAPI parser or reusable retrieval implementation.

## Local Context Metrics

Record deterministic local context metrics from the repository root:

```sh
node docai-http/tools/record-openapi-comparison-metrics.mjs
```

This writes:

- `context-metrics.json`
- `CONTEXT-METRICS.md`

These metrics are UTF-8 byte counts, character counts, and `characters / 4` approximate token counts. They are not provider tokenizer counts and are not live LLM results.

## Run Records

OpenAPI baseline live-run records belong under `runs/*.jsonl`, not under the DocAI HTTP `../runs/*.jsonl` directory. The run record format is documented in `runs/README.md`.

Check context metrics and any non-example run records from the repository root:

```sh
node docai-http/tools/check-openapi-comparison.mjs
```

The checker reuses the complete-candidate automated graders for request construction, response handling, error handling, and workflow completion, so OpenAPI baseline outputs are compared against the same expected outcomes as the DocAI HTTP runs.

## Next Evidence Step

After the prompt contracts, context metrics, and run-record checker are reviewed, add provider-runner support or local execution instructions that write OpenAPI baseline JSONL run records.
