# Calibration 3 Preparation

## Approved Model Panel

On 2026-11-09, the maintainer selected a replacement calibration that retains
`gpt-5.6-sol` and `claude-sonnet-5` and changes only Google's target to
`gemini-3.8-flash`. The new identity is `3.0.0-calibration.3`.

The two tasks, four conditions, three targets, one repetition, 24-request
matrix, 100-attempt ceiling and reliability gate remain the same. The gate
requires at least 23 automatic decisions and at most one exceptional run.
This calibration is non-primary reliability evidence.

Google's [model page](https://ai.google.dev/gemini-api/docs/models/gemini-3.7-flash)
now documents automatic routing from `gemini-3.7-flash` to `gemini-3.8-flash`.
Together with the three reproduced runtime findings, this blocks calibration.2
execution. Historical .1/.2 manifests and artifacts remain intact.

## Required Runtime Corrections

1. A retained `stopped` checkpoint is terminal for automatic re-entry. Return
   its verified result with zero additional calls or writes. Fatal retained
   evidence must agree with the checkpoint; clearing the stop or appending
   work after it is an integrity failure. The two supported crash-recovery
   windows must preserve fatal stops.
2. The actual execute CLI supplies the production clock. Test that executable
   path with mock transports and fake credentials, including verified
   completion and failure before transport when preflight is invalid.
3. Result reports consume only opaque evidence minted by the verifier.
   Include validated attempts in that snapshot for call/usage accounting;
   reject raw stores, fabricated runs and copied evidence. Planning reports
   are a separate interface with zero retained results. Mutating the source
   store after verification must not alter the report.

## Preparation Checklist

- [x] Select the model panel and new calibration identity.
- [x] Write and builder-review the design and implementation sequence.
- [x] Create an isolated draft package and validate its canonical 24-row
  identity, inherited task semantics and absence of prior runtime imports.
- [x] Correct stopped-state verification, resume and crash recovery; add
  regressions for every fatal reason and terminal budget/attempt-cap stop.
- [x] Correct verified report construction and actual execute CLI wiring;
  verify both with synthetic evidence and transports.
- [x] Revalidate exact models, request settings, limits and current prices.
- [x] Regenerate private prompts, hashes and metrics for calibration.3.
- [x] Recalculate provider-specific token/cost estimates and clearly document
  reported-usage stop thresholds, unknown usage and pricing assumptions.
- [x] Review runtime changes and publish the complete one-time freeze.
- [x] Run inherited and new adversarial tests, public/private freeze checks,
  historical integrity checks, readiness, and zero-call dry-run.
- [x] Complete a fresh whole-package review covering the three runtime
  findings and both original retained-evidence exploits.
- [x] Present the exact reviewed execution envelope to the maintainer and
  obtain separate Live confirmation.
- [x] Execute Live only after that confirmation; verify retained evidence
  and gate result before proposing any primary benchmark.

No Live inference call is authorized by the model-panel decision. General
readiness proves local checks; provider availability must be checked again
near execution. This document records preparation, not a passing gate result.

Preparation completed on 2026-11-10: 873 full v3 tests passed, and the final
whole-package review found no unresolved Critical or Important issue. The
approved Live run completed on the same date. Evidence verification passed,
but the reliability gate failed. See [results and next work](OPENAPI-COMPARISON-V3-CALIBRATION3-RESULTS.md).
Completion of this preparation checklist does not authorize a primary run.
