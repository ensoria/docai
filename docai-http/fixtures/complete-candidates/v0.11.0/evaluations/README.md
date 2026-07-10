# Complete Candidate Evaluation Packet

This directory contains the evaluation packet for the complete-surface candidate corpus. It is not live LLM evidence by itself.

Contents:

- `tasks.json` defines representative tasks for request construction, response handling, error handling, and token-load comparison.
- `RESULTS.md` records local context metrics and the current live-LLM evaluation status.

Run `node tools/check-complete-evaluations.mjs` from the `docai-http/` directory, or `node docai-http/tools/check-complete-evaluations.mjs` from the repository root, to check that the task packet references existing files, covers all required task groups, and has evidence strings in the selected retrieval context.

The token-load numbers are deterministic local context metrics. They are useful for spotting obvious regressions, but they are not a substitute for model-specific tokenizer counts or live LLM task results.
