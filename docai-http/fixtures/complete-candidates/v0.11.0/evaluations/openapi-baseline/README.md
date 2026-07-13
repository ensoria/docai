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

Provider runners are available for local execution after explicit approval to send repository-derived prompts and context to the selected provider:

```sh
node docai-http/tools/run-google-openapi-comparison.mjs all --condition raw --target google-stable-agentic
node docai-http/tools/run-anthropic-openapi-comparison.mjs all --condition raw --target anthropic-balanced
node docai-http/tools/run-openai-openapi-comparison.mjs all --condition raw --target openai-frontier
```

Replace `raw` with `sliced` or `enriched` to record the other baseline conditions. By default, each runner selects its required target and the `request_construction` group for the `raw` condition; pass `all --condition <condition>` to run every comparable live task group for one condition.

Check context metrics and any non-example run records from the repository root:

```sh
node docai-http/tools/check-openapi-comparison.mjs
```

The checker reuses the complete-candidate automated graders for request construction, response handling, error handling, and workflow completion, so OpenAPI baseline outputs are compared against the same expected outcomes as the DocAI HTTP runs.

## Next Evidence Step

Run the required targets against the OpenAPI baseline conditions after provider-send approval, then summarize pass rate, fixture-gap rate, context size, provider usage where publishable, and failure categories.
