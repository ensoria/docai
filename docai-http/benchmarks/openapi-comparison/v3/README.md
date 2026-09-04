# OpenAPI Comparison Benchmark v3

Version `3.0.0-calibration.1` is a calibration draft for the OpenAPI comparison
benchmark. It is separate from the closed v2 diagnostic evidence documented in
[`../V2-DIAGNOSTIC-CLOSURE.md`](../V2-DIAGNOSTIC-CLOSURE.md).

The calibration matrix contains 24 requests: one `complete-commerce` API, two
tasks, three provider targets, one repetition, and four context conditions.
Exact model IDs are intentionally absent until a later catalog-verification
step. No provider requests are authorized by this draft.

`plan.json` is the machine-readable calibration boundary. `PLAN.md` explains
the constraints, while `private/` is reserved for ignored prompts, responses,
and run records created only by subsequent approved work.
