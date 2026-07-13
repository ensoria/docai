# Complete Candidate Evaluation Packet

This directory contains the evaluation packet for the complete-surface candidate corpus. It is not live LLM evidence by itself.

Contents:

- `tasks.json` defines representative tasks for request construction, response handling, error handling, workflow completion, and token-load comparison.
- `targets.json` records the required and optional live LLM targets for the evaluation run.
- `runs/` records live LLM result JSONL files when model calls are executed.
- `RESULTS.md` records local context metrics and the current live-LLM evaluation status.

Run `node tools/check-complete-evaluations.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-evaluations.mjs` from the repository root, to check that the task packet references existing files, covers all required task groups, has evidence strings in the selected retrieval context, records a target model list for live evaluation, and validates any live result JSONL files under `runs/`.

Run `node tools/build-complete-evaluation-prompts.mjs request_construction` from the `docai-http/` directory, or `node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction` from the repository root, to emit JSONL prompt records for the required request-construction target/task combinations. Add `--include-optional` to include optional targets, and `--summary` to print only the record count and selected IDs. These prompt records intentionally omit `expected_outcome` so the live model is not given the grading answer.

Run the provider-specific live runners from the repository root to execute required targets and merge reviewed JSONL records into `runs/request-construction.jsonl`:

```sh
node docai-http/tools/run-google-complete-evaluation.mjs request_construction --target google-stable-agentic
node docai-http/tools/run-anthropic-complete-evaluation.mjs request_construction --target anthropic-balanced
node docai-http/tools/run-openai-complete-evaluation.mjs request_construction --target openai-frontier
```

These commands require `GOOGLE_API_KEY`, `ANTHROPIC_API_KEY`, or `OPENAI_API_KEY` respectively and send the selected evaluation prompts and context to the corresponding external model provider API.

The Google runner sends the configured `temperature` value from `targets.json`. The Anthropic and OpenAI runners omit `temperature` because the current required target models reject that parameter. Determinism for those targets is handled by fixed prompts, no tools, reviewed JSON output, and the request-construction grader.

If a managed Codex environment blocks external provider data export, record the affected runs as `blocked` and have a maintainer run the same command locally outside that managed environment. Replace the blocked records with reviewed provider results after local execution.

Request-construction grading normalizes representation choices that are equivalent under the supplied DocAI HTTP context: endpoint paths may include the documented `/v1` base path, `Authorization: Bearer <access_token>` accepts concrete fake bearer-token placeholders, multipart part content types may be represented as either direct `content_type` fields or `headers.Content-Type`, and multipart boundary delegation is evaluated through an explicit boundary-handling field.

The token-load numbers are deterministic local context metrics. They are useful for spotting obvious regressions, but they are not a substitute for model-specific tokenizer counts or live LLM task results.
