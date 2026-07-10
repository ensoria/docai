# Complete Candidate Evaluation Packet

This directory contains the evaluation packet for the complete-surface candidate corpus. It is not live LLM evidence by itself.

Contents:

- `tasks.json` defines representative tasks for request construction, response handling, error handling, workflow completion, and token-load comparison.
- `targets.json` records the required and optional live LLM targets for the evaluation run.
- `runs/` records live LLM result JSONL files when model calls are executed.
- `RESULTS.md` records local context metrics and the current live-LLM evaluation status.

Run `node tools/check-complete-evaluations.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-evaluations.mjs` from the repository root, to check that the task packet references existing files, covers all required task groups, has evidence strings in the selected retrieval context, records a target model list for live evaluation, and validates any live result JSONL files under `runs/`.

Run `node tools/build-complete-evaluation-prompts.mjs request_construction` from the `docai-http/` directory, or `node docai-http/tools/build-complete-evaluation-prompts.mjs request_construction` from the repository root, to emit JSONL prompt records for the required request-construction target/task combinations. Add `--include-optional` to include optional targets, and `--summary` to print only the record count and selected IDs. These prompt records intentionally omit `expected_outcome` so the live model is not given the grading answer.

The token-load numbers are deterministic local context metrics. They are useful for spotting obvious regressions, but they are not a substitute for model-specific tokenizer counts or live LLM task results.
