# Calibration 3 Reliability Gate

Stopped-resume corrections passed Task 2 review; execute CLI clock and
verified-report corrections passed Task 3 review. The November 10, 2026
Task 4 freeze binds current model/cost inputs and regression tests. Verify
the manifest; Task 5 review and explicit Live approval remain outstanding.

Calibration `3.0.0-calibration.3` is non-primary reliability evidence. It
uses the fixed 24-run matrix and cannot contribute to primary accuracy
estimates, condition contrasts, or adoption claims.

The gate requires all 24 canonical identities, all four
conditions for every task/target pair, at least 23 automatic decisions, and no
more than one exceptional run. It will consume only records verified by the
package-local evidence verifier, which recomputes every derived result from
retained provider evidence and the canonical private task packet.

Manual review remains restricted to verified automatic `inconclusive` records
and is secondary evidence. It cannot rewrite automatic result fields. Private
packets, provider responses, runs, checkpoints, and adjudication records stay
under this package's ignored `private/` directory.

This packet authorizes no provider request, schedule execution, or manual
adjudication.
