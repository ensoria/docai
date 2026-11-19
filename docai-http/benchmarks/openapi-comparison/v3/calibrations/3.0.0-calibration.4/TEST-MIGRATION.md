# Successor Test Migration

All 16 historical .3 test files and both helpers are copied to successor-only
paths. Historical identity/plan tests use `calibration4-inherited-identity` and
`calibration4-inherited-plan` names; new focused identity/plan tests define the
Task 1 acceptance boundary. No inherited test is skipped, marked TODO, or weakened
to manufacture green results. Run `node --test docai-http/tools/tests/openapi-comparison-v3-calibration4-*.test.mjs`
only at the phase6B whole-package checkpoint. Phase7A runs its owned and affected
tests, not broad historical/full-package suites. Earlier red migration results
remain chronological evidence, not a claim about current phase7A bytes.

| Successor test suffix | State / migration dependency |
| --- | --- |
| identity, plan | Phase-aware initial draft/prepared draft/published freeze checks; prepared inputs do not authorize execution. Retains disabled-anchor actual CLI zero-fetch checks. |
| inherited-identity, inherited-plan | Successor-only synthetic frozen fixtures and exact .4 schedule ordering; historical tests unchanged. Retains private-output ignore and null-anchor guards. |
| parser | Inherited parser regression baseline; retain |
| prompt, parity | Task 2 public schemas, context and source-ledger migration |
| grader | Tasks 2-3 structured shapes and semantic predicates |
| adapters | Task 4 token settings, completion and provider usage migration |
| cost | Phase6A preparation accepted: exact candidate catalog, disjoint prices, reconstructed envelope, dated offline integrity/current-time send eligibility. Not Live authorization. |
| runner, stop | Scoped-accepted Task5 native accounting/stopping; disposable fixtures bind the complete revision closure. |
| evidence, gate, adjudication, report | Scoped-accepted Task5 evidence and terminal negatives, including unknown charges; whole-package6B remains pending. |
| cli, freeze | Offline synthetic anchoring, complete closure and transactional rollback/directory-sync regressions; actual7B production anchor/manifest remain absent. |
| authority | Exact manifest-byte pin under a separately trusted fixed data root; same-ID/time reseals, all payload classes, raw root revision, malformed/path/override controls and acyclic prepare/pin publication. |

The copied helper can only synthesize its own disposable package. It does not
read predecessor private data or patch the production trust anchor. Its current
model/cost dependency uses the reviewed .4 candidate policy, never old prices.
Tests that pass against old shapes are only baseline regression evidence, not
proof of the approved .4 semantics. Exact observed failures and counts are in
the Task 1 report. Later tasks must migrate assertions and fixtures explicitly
and retain the adversarial cases, not delete or blanket-skip them.

Phase7A A1 refinement: null authority disables frozen acceptance/publication,
not pure in-memory candidate preparation. Fixtures prepare the final plan and
manifest before pinning only their disposable root. The whole verifier is never
patched to insert a digest/time. Root replacement in a fixture is explicitly a
new trusted approval, not evidence that a root can authenticate itself. Native
response/accounting fixtures retain their accepted shapes and original clock.

## Historical Baseline Observed By Coordinator

The untouched .3 full suite is 293/294. Its first `freeze.test.mjs` test (line 76)
enumerates physical private files and expects all of them in frozen paths;
genuine Live private runs/checkpoints now exist, while the runtime correctly
excludes dynamic stores. Historical `.3` `freeze.mjs --check --private-required`
passes. Do not change .3 tests, artifacts or Live records to repair that test.
The successor phase7A freeze test explicitly exercises designated dynamic-store
exclusion in disposable fixtures while sealing prompts, metrics and arbitrary
private inputs. No production stores are fabricated. This reported .3 baseline is distinct
from the executable .4 migration failures.

## Phase6B Verification Matrix

Keep three distinct evidence sets: current C4 suite acceptance; immutable
historical as-of checks; and actual-checkout freeze/retained-evidence checks.
The root `openapi-comparison-v3-release-readiness.test.mjs` is a mutable shared
integration test, absent from all three frozen v3/.2/.3 manifests. Its stale
pending-.3-Live assertion is corrected during the explicitly authorized7A
extension: .3 Live completed/gate failed; .4 prepared/not authorized. Command
and no-Live guards, all four tests and the exact legacy `CHECKS` registry are
retained. Actual .4 registry metadata and the shared test change together only
at7B. Do not change frozen versioned tests, revert legitimate TODO completion
or blanket-skip tests to manufacture green evidence.

Controller-verified historical evidence uses the tracked tree at pre-Live
commit `711aaaa` (read-only Git archive) plus47 SHA-matching frozen private
inputs and873/873 old tests as of that commit. This is not a current-checkout or
C4 whole-package success claim. Actual-checkout root v3/.2/.3 freeze checks
and .3 retained-evidence checks have separately passed per controller evidence.
Before the shared-status correction, the controller's separate current
historical inventory was871/873: only .3 private enumeration and the stale
mutable shared-status test failed. That871/873 is chronological evidence, not
a post-fix result. The existing .3 immutable input-only snapshot294/294 versus
native293/294 distinction above remains valid. No broad historical suite is
rerun in7A; integrated/historical verification belongs to6B.
