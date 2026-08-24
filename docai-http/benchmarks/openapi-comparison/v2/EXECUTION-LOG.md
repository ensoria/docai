# Benchmark v2 Execution Log

This log records execution events that affect benchmark provenance without
publishing private prompts, holdout facts, provider responses, or credentials.

## Superseded `2.0.0-frozen.2` Run

- Source commit: `6e8e3fdc6e3ffd8a5b02ee8caf628533b941ab19`
- Batch: `b01`
- Execution window: 2026-08-24T07:17:34.465Z to 2026-08-24T07:18:19.152Z
- Provider/model reached: OpenAI `gpt-5.6-sol`
- Retained attempts and responses: 4
- Provider-reported usage: 12,452 input tokens and 2,520 output tokens
- Estimated recorded cost: `$0.137860`
- Original automatic outcomes: 4 inconclusive
- Retained private path: `private/runs/2.0.0-frozen.2/b01/`
- Primary-analysis inclusion: no

The run stopped because malformed plus inconclusive records exceeded 5% after
four responses. Investigation found two pipeline defects: HTTP credential and
idempotency placeholders were compared as literal strings, and the 5% review
rule was enforced during the batch even though the preregistered plan defines
it as a gate before the next batch. Local regrading with the corrected semantic
header contract classifies the enriched OpenAPI and DocAI HTTP responses as
passes while leaving the raw and sliced OpenAPI responses inconclusive.

The retained responses are diagnostic evidence only. They are not silently
rerun, rewritten, or included in the 648 primary observations. Corrected
execution restarts under the separately frozen `2.0.0-frozen.3` identity.
