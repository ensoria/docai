# V2 Diagnostic Closure

OpenAPI Comparison Benchmark v2 is closed as immutable diagnostic evidence.
Its final identity is `2.0.0-frozen.3`.

The only executed v2 batch, `b01`, contains 72 records. Of those records, 12
were malformed and 51 were automatically inconclusive. One blinded reviewer
adjudicated all 51 automatically inconclusive records as 17 correct, 34
incorrect, and 0 unresolvable. Inter-rater agreement was not measured because
there was one reviewer.

Batches `b02` through `b09` are cancelled and must not execute. The v2
results cannot support an accuracy headline: the automated outcomes include
the malformed and inconclusive records, while the limited manual adjudication
does not create a complete or independently corroborated accuracy result.

V3 calibration is a separate benchmark pipeline. It does not alter, regrade,
or aggregate the frozen v2 evidence.
