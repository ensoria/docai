# Calibration 2 Reliability Gate

Calibration `3.0.0-calibration.2` is non-primary reliability evidence. It
uses the fixed 24-run matrix and cannot contribute to primary accuracy
estimates, condition contrasts, or adoption claims.

The eventual gate will require all 24 canonical identities, all four
conditions for every task/target pair, at least 23 automatic decisions, and no
more than one exceptional run. It will consume only records verified by the
package-local evidence verifier, which recomputes every derived result from
retained provider evidence and the canonical private task packet.

Manual review remains restricted to verified automatic `inconclusive` records
and is secondary evidence. It cannot rewrite automatic result fields. Private
packets, provider responses, runs, checkpoints, and adjudication records stay
under this package's ignored `private/` directory.

This draft authorizes no provider request, schedule execution, or manual
adjudication.
