# Calibration Reliability Gate

Calibration is a non-primary reliability check for
`3.0.0-calibration.1`. It evaluates the fixed 24-run schedule before any
primary benchmark can be frozen. Calibration records never enter primary
accuracy estimates, condition contrasts, or adoption claims.

The gate passes only when all 24 canonical run identities are present, every
task/target pair contains all four conditions, and the records have no terminal
provider or transport error, incomplete response, token-limit completion, or
implementation defect. It also requires at least 23 automatically decided
records (`pass` or `fail`) and at most one distinct exceptional run. A
non-raw JSON format, invalid output contract, or inconclusive automatic
accuracy makes a run exceptional; multiple such dimensions on one run count
once.

Semantic pass rate is reported as an experimental diagnostic only. A low rate
does not decide machinery reliability and cannot make calibration fail or pass.

Only records whose automatic `accuracy_status` is `inconclusive` enter the
manual packet. The packet uses exactly one condition/provider/model-blinded
reviewer, records that inter-rater agreement was not measured, and preserves
the automatic result as primary evidence. Manual decisions never rewrite
format, contract, automatic pass/fail, or any non-inconclusive record.

Private packets are written only below
`private/adjudication/3.0.0-calibration.1/`, which is git-ignored. Do not copy
the private packet or its source run records into public reports.

```text
node docai-http/tools/check-openapi-comparison-v3-calibration.mjs
node docai-http/tools/openapi-comparison-v3-adjudication.mjs --write
node docai-http/tools/check-openapi-comparison-v3-adjudication.mjs --require-complete
```
