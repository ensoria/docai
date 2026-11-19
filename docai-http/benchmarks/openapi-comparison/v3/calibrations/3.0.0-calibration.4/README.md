# Calibration .4

Identity: `docai-http-openapi-comparison-v3` / `3.0.0-calibration.4`.
Task 1 establishes an isolated, offline-only draft: two tasks, three targets,
four conditions, one repetition, 24 scheduled requests. The gate remains
23 automatic decisions and at most one exceptional run.

This is not a frozen or execution-authorized package. Plan target model IDs
remain null. Fresh candidate model/cost data and private prompt/context inputs
have been prepared and reviewed; none were inherited as authorization. There
is no enabled trust root, published manifest or retained run. Pure offline
preparation is possible; frozen validation and publication fail closed. An execution approval variable alone
cannot enable sends. Candidate validation is not an execution capability.

Task 1's isolated baseline and Task 2's structured answer contracts, six
continuity tasks and source ledger have passed their scoped independent
reviews. The source ledger has 89 measured predicates and two contextual-only
rows. Task 3 semantic grading is independently reviewed and complete with
207/207 covering tests. Task 4 now implements provider-specific usage ledgers
and 16,384-token adapter settings;74/74 covering tests pass after review fixes.
Its scoped review is complete for the maintainer-approved single-request
accounting domain. Unexpected Anthropic iterations remain unknown/unpriced;
Task 5's native retained-evidence verification and terminal stopping have passed
scoped independent review, including realistic native-envelope fix1. Phase6A candidate
model/cost/prompt preparation is independently reviewed, including dated
offline integrity versus current-UTC send eligibility. See
`MODEL-COST-PREFLIGHT.md` for the prospective non-invoice envelope. Verified
execution/budget handling is scoped-accepted. Phase7A implements offline freeze
closure and transactional publication in disposable synthetic fixtures only.
Phase6B whole-package checks/review and phase7B actual anchoring/publication
remain pending. No Live or full-suite success is claimed. See
`TEST-MIGRATION.md` for inherited coverage and migration state.

Package state is determined by `plan.json` and `freeze-manifest.json`, not this
heading or the presence of prepared inputs. A draft with candidate model/cost
packets and private prompts/metrics is **prepared**, not frozen. A frozen plan
requires its published manifest, reviewed trust anchor and successful hash/runtime
validation. Phase7A leaves the plan draft, all target IDs null, anchor null and
manifest absent. No production run/checkpoint/adjudication stores are created.
Synthetic fixture timestamps and identities are test data, not freeze evidence.
Actual7B must use reviewed current identity, runtime and real UTC publication time
after6B and a fresh official catalog/rate/settings check. The existing candidate
packet was checked2026-11-13; its earliest rate window ends2026-11-30.
Outer readiness registration is actual7B-only. Separate Live approval is required.

### Publication Outcomes

The offline publisher returns `{status: "committed"}` on clean success. Failures
before lock release restore the draft while ownership is held. After release,
cleanup failure instead returns `{status: "committed-with-cleanup-error",
cleanupErrors: [{operation, message}]}`; it never rolls back or removes another
owner's lock. If an unlink error leaves ownership unverifiable, the committed
pair is likewise left intact with an explicit cleanup outcome.
The CLI prints `FREEZE_COMMITTED_CLEANUP_ERROR` and exits2 for that outcome,
not the ordinary failure exit1 or clean-success exit0. Do not retry publication,
rebaseline, or remove a possibly owned lock. Run `freeze.mjs --check
--private-required`, inspect lock ownership and directory durability, and resolve
cleanup before proceeding. A passing check is not a durability repair or Live
authorization. Persistent storage failures can require operator intervention.

Runtime dynamic discovery is conservative: every raw keyword candidate is
checked, including inert text; only plain single-string dynamic arguments are
accepted. Comments between keyword and call support LF/CR/CRLF/U+2028/U+2029.
Computed arguments, escaped literals and options are rejected, even if an inert
example could otherwise be harmless. Static dependencies still use V8 parsing.

### Exact Manifest Authority

The maintainer approved strong artifact authority on2026-11-19. Its fixed,
data-only `runtime/freeze-authority.mjs` record uses format
`docai-calibration-freeze-authority`, version`1`, exact benchmark/plan IDs and
`manifest_sha256`: lowercase SHA256 of the entire final manifest file's raw
bytes, including its final LF. That digest remains null in production7A.
Frozen acceptance hashes bounded manifest bytes before parsing, then checks
the unchanged manifest-v1 schema, complete raw payload hashes and plan seal.
There is no normalized-plan-identity fallback or caller-selected root.

The exact authority module is the sole additional trusted-root exclusion from
payload discovery, including transitive dependencies. It must remain a regular,
non-symlink canonical data export; imports, getters, extra fields or alternate
formats are rejected. Its entire raw bytes are included explicitly once in
default runner revision. All ordinary payloads, including the whole verifier
and final plan, retain their existing raw SHA256 semantics. No signature, key
custody, descriptor/mode format or historical manifest change is introduced.

Offline order: finalize payload -> compute existing non-plan consistency seal
-> final plan -> final canonical manifest -> separately reviewed root pin ->
runner revision. No value derived from the pinned root is stamped back into a
payload, plan or manifest. The root is independently trusted, not self-
authenticated: replacing that trusted root is outside the fixed-root guarantee;
runner hashing records its provenance, not approval of a replacement.

`buildCalibrationFreeze` is a pure offline preparer requiring an explicit
`frozenAt`. It returns `{plan, manifest}` without writing or pinning anything,
even with a null root. Store that canonical candidate outside the package.
Only actual7B after6B/review/source checks may establish its reviewed root pin.
The publication form is `freeze.mjs --write --private-required --candidate
<reviewed-file>`: the file supplies candidate bytes, never authority. Publication
authenticates the pair against the installed root, rechecks source/draft bytes,
and writes only the fixed plan/manifest pair using the existing transaction.
It cannot create or rewrite the root. Existing frozen valid state is an
idempotent no-write check; partial/differing state blocks replacement.
Prepared overrides can supply only the authenticated final plan, not arbitrary
payload bytes, a replacement manifest path, or authority. Absent private inputs
in public checks authenticate their commitments only; publication/Live still
require those inputs. All existing separate Live authorization guards remain.

A1 implementation still requires scoped independent acceptance; full7A,6B and
actual7B are not completed by these draft changes.

The historical .3 package and its failed result remain immutable. There are no
runtime imports into predecessor packages. Authoritative Stable fixtures are
read-only inputs; they are not duplicated or changed by this draft.

Offline checks from the repository root:

```sh
node --test docai-http/tools/tests/openapi-comparison-v3-calibration4-{cost,prompt,parity,ledger}.test.mjs
node docai-http/benchmarks/openapi-comparison/v3/calibrations/3.0.0-calibration.4/runtime/check-plan.mjs
```
