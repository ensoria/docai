# Calibration 4 Design

## Approval Status

On 2026-11-10, the maintainer selected approach A from the
[calibration.3 audit](OPENAPI-COMPARISON-V3-CALIBRATION3-AUDIT.md): an explicit
structured semantic answer contract with deterministic grading.

The maintainer approved this detailed design on 2026-11-10, including scored
validation constraints and the 16,384 generated-token limit policy. The
successor identity is `3.0.0-calibration.4`. Approval does not authorize a
freeze, API fees or Live calls. The .3 result remains failed and immutable.
The [implementation plan](OPENAPI-COMPARISON-V3-CALIBRATION4-PLAN.md) and
subagent-driven implementation were also approved on 2026-11-10. Offline
implementation is in progress; freeze and Live approval remain separate.

## Intent And Scope

Measure whether supplied API documentation supports correct, safe HTTP client
planning, without confusing semantic correctness with arbitrary answer
spellings. Calibration first establishes reliable evaluation, not superiority
of DocAI or an accuracy target. Do not optimize the grader to pass .3 answers.

Retain the two calibration tasks (document upload and checkout), three
providers, four conditions, one repetition and 24 scheduled requests. Keep
the 23 automatic-decision / one exceptional-run reliability gate, complete
identity/pair checks, and rejection of incomplete responses. Semantic pass
rate remains diagnostic and is not a calibration gate threshold.

Audit all six inherited task definitions and their five exercised answer-contract
families offline because they share grading primitives. The inherited
`retrieval-selection.v3` contract has no task in this packet; it is not a sixth
measured family and its redesign is outside this work. Only the two designated
tasks enter
the 24-call calibration. Do not claim Live validation of the other tasks or
create the future 648-request primary schedule in this work.

Non-goals: changing DocAI HTTP 1.0.0, modifying authoritative conformance
sources/projections, adding an LLM judge, scoring unrestricted source code,
repairing retained .3 answers, or pooling scores across calibration identities.

## Approaches

| Approach | Benefit | Cost or risk | Decision |
|---|---|---|---|
| A. Public structured semantics with deterministic grading | Reproducible answer locations, explicit safety predicates, bounded normalization and negative controls | Adds public-contract tokens; measures constrained planning rather than free-form implementation | Selected by maintainer |
| B. Extend equivalence rules over free-form fields | Accommodates more natural wording | Difficult to bound synonyms/layouts; risks hidden false positives/negatives | Not selected |
| C. Separate LLM judge | Interprets varied prose | Adds judge bias, variability, API cost and a second calibration problem | Not selected |

## Public Answer Contract

The following engineering choices were approved as part of this design.

### General Rules

Publish a closed answer schema and its generic interpretation in every
condition. Display the answer schema itself, not a metadata wrapper that
looks like an answer. Contract identity/version belongs outside that schema;
explicitly forbid copying it into the returned object. Do not add
provider-specific constrained decoding: all providers receive the same
ordinary text/JSON contract, so API feature support is not another variable.

Each scored field has one documented location and type. Required unknown
values use an explicit status/value representation rather than a fabricated
string. Use one generic value record:

- Known value: `{"status":"known","value":...}`.
- Missing evidence: `{"status":"unknown","value":null}` and a matching
  JSON-pointer entry in `uncertainties`.

The schema distinguishes unknown from known-null. Task-specific schemas
constrain the type of a known value. Invalid status/value shapes or types are
contract errors. Missing uncertainty entries are semantic consistency errors,
as defined in the grading-layer table below. No private expected fact or
per-condition missing-fact list enters prompts.

Collections also need uncertainty about membership, not just individual values.
Use a public collection record with `status` and `items`: `complete` claims
the member inventory is known; `partial` preserves known members while declaring
that others may be undocumented; `unknown` has an empty inventory. This status
does not certify that the members are correct. Apply it to headers, steps,
recovery cases and state facts wherever membership can be undocumented.
A partial/unknown collection points to its collection field in `uncertainties`;
the model need not invent the missing member's name. A complete membership list
can still contain an unknown value for an identified member.

The evidence ledger maps missing and available facts to these public collection
paths, so correctly declaring incomplete membership is not automatically an
over-broad uncertainty error. Score known members and missed available facts
individually. A partial answer cannot claim whole-task success, but remains
contract-valid unless its structure/types are invalid.

Public conventions must be neutral across documentation formats. Generic
enum choices may include alternatives, but never identify the correct choice
for the task. No examples copied from the expected task answer. Optional
unscored rationale, if retained, cannot override a contradictory scored field.

### HTTP Requests And Symbolic Values

Use one request layout: method, expanded wire path (including any documented
server base path), path parameters, query, headers, body, multipart parts and
explicit content-type/boundary handling. State how to combine server base path
and operation path once; preserve case, encoding and meaningful trailing
slashes. Do not silently repair an incorrect wire path.

Headers are case-insensitive by name; duplicate case-variant names are rejected
as semantic identity conflicts.
Values follow documented wire semantics, not a blanket lowercase/substring
rule. Symbolic unavailable credentials and generated keys use typed references,
not privately chosen placeholder strings:

- A task-input reference identifies a public input by its documented name.
- An external-input reference identifies a required value not supplied by the
  task (for example, a credential). This is not automatically a missing API
  documentation fact.
- A generated-value reference identifies a generation rule and logical scope.
- A prior-step-output reference identifies step ordinal and returned field.

Reference identity is structural. Valid step relationships use unique ordinals
and backward references. Generated-value references distinguish logical scopes;
they do not publicly require keys, unique keys per operation, or any retry
policy. Whether a particular operation requires a key, whether another
operation may share it and what a retry must preserve are API facts learned
only from supplied documentation. The private source-mapped predicates check
those policies. A key string's arbitrary spelling is not scored; documented
scope or reuse violations are scored.
The builder defines concrete discriminated schemas for reference shapes and
semantic predicates for their cross-references, rather than free JSON.

Represent multipart media type and boundary management separately. Generic
boundary modes are library-managed, caller-specified and unknown. A documented
library-managed boundary requires that mode and no hard-coded boundary value.
A base media type alone is insufficient evidence of correct boundary handling.
Part names, filename, MIME type, JSON metadata and retry preservation remain
separately scored.

### Validation Constraints

Include structured request validation constraints in the scored task scope.
For document upload, score the supplied file/metadata maximum sizes, accepted
part media types and required filename behavior from the existing sources.
Represent absent documentation as unknown, not as an invented safe default.
The exact answer fields and assertions must be public/source-mapped before
freeze. Do not continue labeling `documents:size-limits` measured without
actually checking it.

This is an approved scope clarification, not a Stable API change. It makes
the measured claim include safety-relevant constraints; .4 scores cannot be
compared to .3 as if only the model changed.

### Workflows And Recovery

Steps are an ordered list with consecutive unique ordinals, explicit operation
identity, the same request-input layout, retained typed references and state
facts. Preserve order where execution depends on it; sets are explicitly
declared and checked for duplicates. Reject extra contradictory or unsafe
steps even when the expected steps are also present.

Represent state as separate subject/state facts, using a public, generic
vocabulary (for example, payment and order are separate subjects). Map source
prose to those facts through the reviewed evidence ledger. Do not require
DocAI's dotted display labels when another condition describes the same
behavior in prose. Do not normalize negation away or accept arbitrary strings
containing the desired label.

Recovery uses structured trigger, affected operation, allowed action,
preserved references and repeat-side-effect policy. Use public generic trigger
categories rather than private prose case labels. Event reconciliation
identifies event, join key, resulting subject states, continuation operation
and whether another capture is allowed. A prose explanation cannot cancel an
unsafe boolean or a mismatched operation/reference. These fields and generic
enum alternatives define an answer language, not the operation's correct
policy. Public instructions must not assert same-key replay, no-recapture,
specific states or other facts absent from a condition's documentation.

### Other Task Families

For response, error and webhook contracts, apply the same rules:
explicit public locations, typed known/unknown values, exact wire identifiers,
bounded set/list semantics and structured actions. Give response shape,
presence, nullable handling, error recovery and webhook delivery/deduplication
their own predicates rather than accepting matching substrings.

Keep successor-only contract identifiers distinct from the .3 identifiers.
Final field names and contract-ID suffixes are builder decisions recorded in
the implementation plan and reviewed schemas. Their complete inventory is a
pre-freeze deliverable, not something inferred during Live execution.

## Deterministic Grading

Schema validation precedes semantic grading. Use exact scalar equality by
default; explicit field-specific normalizers only where the public contract
and wire semantics permit them. No generic substring matcher for scored
paths, identifiers, states or case labels. Reordered sets may be equivalent;
step order, byte-preservation rules and JSON metadata values are not generic
sets. Reject conflicting additional facts as well as missing expected facts.

Fix the layer boundary prospectively; a builder must not move a model error
between layers to satisfy the reliability gate:

| Layer | Examples | Outcome |
|---|---|---|
| Format | Non-JSON, truncated provider response | Existing format/completion handling; exceptional where defined by gate |
| Contract | Missing required answer fields, wrong JSON types, unsupported enum token, forbidden extra answer field, malformed status/value or reference shape | Contract invalid; semantic not evaluated; exceptional |
| Semantics | Wrong path/state, duplicate ordinal, dangling/forward reference, conflicting headers/facts, undocumented or unsafe key reuse/retry, missing uncertainty correspondence, contradiction between unknown/known claims | Contract valid; automatic semantic fail with a specific category |
| Evidence discipline | Correct gap, missed available fact, unsupported claim | Separate diagnostics; cannot turn required capability failure into success |
| Implementation/accounting | Invalid retained evidence, ambiguous usage normalization, evaluator defect | Stop execution and preserve evidence; not a model semantic score |

Reference shapes and collection shapes are schema-validated; cross-reference
validity, set uniqueness and execution order are semantic predicates. Public
instructions state those language conventions before execution. Preserve the
gate's numerical thresholds and its meaning as reliability of automatic
decisions, not a threshold for the model's task correctness.

Freeze a source-to-predicate ledger for all six tasks. Every scored predicate
must list its public output rule, source file and section/parsed pointer,
required fact, condition availability and negative control. Every fact claimed
as measured must have a predicate; contextual but unscored facts are labeled
separately. A fact-ID annotation alone does not prove source parity. Review
the actual rendered contexts, not just inventory equality.

Report separately:

1. Whole-task semantic success: all required capability predicates are correct.
   Correctly reporting a missing required fact does not count as implementing
   the whole task. A valid explicit unknown produces an automatic semantic
   fail, not an exceptional/inconclusive pipeline result.
2. Evidence discipline: distinguish correct missing-evidence declarations,
   missed available facts and unsupported assertions. Extra/over-broad
   uncertainty claims do not earn credit; known/unknown contradictions fail.
3. Transport, format, contract and gate status, without merging them with
   semantic success or evidence-discipline diagnostics.

The enriched-OpenAPI versus DocAI pair is the intended same-information format
comparison. Raw/sliced context experiments also vary information completeness;
label that difference explicitly. No cross-identity pooled accuracy estimates.

## Provider Usage And Completion

Retain native usage unchanged. Normalize through separate provider adapters
with an explicit component ledger: uncached input, cache read, cache write by
duration when applicable, visible/final output when known, reasoning when
known, billable generated total, provider total and completeness status.
Overlapping native components must not be counted twice. Unknown is not zero.

The normalized record distinguishes native totals from derived totals and
uses a frozen provider-specific accounting policy. Reconcile supported native
fields and reject unexplained mismatches or ambiguous billing as an accounting
defect that stops further sends. Preserve missing response usage as unknown;
do not classify a charge as free. All charge-bearing attempts, including
incomplete responses and any response-bearing failures with usage, enter
budget accounting.

Maintainer-approved boundary (2026-11-13): Anthropic accounting targets the
fixed standard-version single request, without beta, tools, compaction,
advisor or fallback features. Unexpected `usage.iterations` is outside this
reviewed domain: retain the native response, leave its charge unknown, and
stop subsequent sends. Do not infer overlap, another model's rate or a free
request. Accepting this bounded policy does not assert that such responses
cannot occur; legitimate responses can stop the calibration. Full iteration
accounting requires a separate reviewed contract, not a permissive fallback.
The runner and verifier must enforce this boundary before freeze.

For Google Interactions, include separately reported thinking in generated
billing tokens. For OpenAI, reasoning already included in output is a subset,
not an additional charge. For Anthropic, retain separate uncached/cache-read/
cache-write input categories and avoid summing write-duration breakdowns with
their aggregate. Revalidate provider documentation and prices before freezing;
do not infer cached pricing from the base input rate.

Store completion status and explicit provider stop reason separately. Unknown
incomplete reason remains unknown; near-budget counts are diagnostic, not
proof of a token-limit reason. Incomplete responses never become completed
answers through parsing, repair or continuation calls.

## Approved Design Settings

Retain the .3 model panel as intended targets, subject to fresh catalog checks.
No automatic model substitution or redirected-model acceptance. A model change
returns to the maintainer for selection.

Raise the requested generated-token limit from 8,192 to **16,384
for each provider**, retaining OpenAI medium reasoning, Anthropic adaptive
thinking and Google medium thinking where still supported. This prioritizes
completion while keeping one fixed limit across tasks/conditions. It does not
prove equal effective reasoning across providers or guarantee completion.

Alternatives considered: lowering Google's thinking level could reduce cost
but also changes reasoning behavior; retaining 8,192 risks the reproduced
truncation. The proposed larger limit preserves the reasoning mode but raises
the maximum output allocation and possible cost. This is an approved design,
not an approved spending envelope. Offline tests can validate wiring and
accounting but cannot demonstrate Live completion.

Recompute prompts and estimates after schema review. At this approved design limit,
24 logical calls allocate at most 393,216 requested generated tokens before
retries. Recalculate token/USD stopping thresholds with current provider
pricing, cache policy and unknown-usage handling. Present the exact envelope
for separate approval; do not reuse the .3 dollar estimate or authorization.
Retain at most one pre-response transport retry per logical request, the
100-attempt work-step ceiling, no response-bearing retries, serial execution,
terminal-stop preservation and zero-call re-entry checks. The 24-call
calibration remains the exception to normal 50-100-call work steps.

## Isolation, Verification And Freeze

Use a new isolated versioned package and private namespace. Preserve all
.1/.2/.3 and v2 artifacts. Do not import mutable predecessor runtime modules
at execution time. Carry forward verifier-minted evidence, actual execute-CLI
clock wiring, fatal-stop recovery, secret redaction and transactional freeze
safety. Add successor tests; do not edit historical tests to redefine results.

Required acceptance evidence before freeze:

- All six canonical synthetic task outcomes pass the new public schemas and
  predicates. A positive baseline is necessary but not sufficient.
- Permanent positive/negative tests cover every .3 audit case, including wrong
  path suffixes, negated states, duplicate ordinals, alternate key references,
  boundary behavior, unsafe replay and source-supported validation limits.
- Public contracts include no expected answer/private assertion leakage.
  Every model/condition receives identical task and contract instructions.
- The evidence ledger is reviewed against actual source/rendered content for
  all scored task facts and per-condition availability.
- Provider-native usage cases cover thinking overlap/separation, caches,
  absent/invalid usage, incomplete responses and budget-trigger boundaries.
- Mocked actual CLI execution covers all 24 identities, stop/re-entry and
  recovery paths, with zero real provider calls.
- Old manifests still verify; new public/private freeze verification succeeds;
  full scoped/inherited tests pass and an independent package review closes
  important findings before the one-time freeze.

Do not publish a regraded .3 score as .4 Live evidence. Synthetic tests and any
offline replay diagnostics are labeled as such, never substituted for new
independent model responses.

Maintainer decision (2026-11-19): the successor trust anchor must authenticate
the complete reviewed artifact set. Matching identity/timestamp and a
self-consistent plan/manifest are insufficient: changing a reviewed file and
resealing it under the same identity must fail against the unchanged trusted
anchor. Document the self-reference boundary explicitly; do not silently
reinterpret raw file SHA-256 values or weaken this to a Git-review assumption.
This decision does not authorize the production freeze or Live inference.

Builder mechanism for that approved requirement: directly import one fixed,
data-only `runtime/freeze-authority.mjs` record containing the authority
format/version, benchmark/plan identity and SHA-256 of the exact final manifest
bytes. Keep its digest null during offline implementation. This separately
reviewed trust root is the sole additional named exclusion from the
authenticated payload, not an exclusion of a directory or arbitrary dependency.
The complete verifier and all ordinary payload files retain raw whole-file
hashes; do not normalize source spans. Compute final plan and manifest before
pinning the root, then include the entire root bytes in runner revision without
embedding that revision back into authenticated inputs. Publication must not
rewrite or choose the root. All frozen/publication/Live validation must compare
the exact manifest bytes against it, with no identity-only fallback.

Authenticity is relative to the independently reviewed verifier and root;
neither hashes nor signatures bootstrap trust in their own replacement.
Replacing that trusted root is outside the fixed-root guarantee. Detached
signatures were considered but add signer custody and authenticate reusable
signing authority rather than uniquely pinning one reviewed bundle; those
distribution requirements are not needed here. Preserve the two-file
publication transaction and its explicit post-commit cleanup outcomes.

## Stages And Approval Boundaries

1. Maintainer approves this design, including measured scope and proposed
   output-limit policy, or requests revisions.
2. Write and review a detailed implementation plan; create the successor
   package only after design approval.
3. Implement with permanent regressions, inspect source coverage, validate
   provider mappings and recalculate models/settings/costs.
4. Independently review, freeze once, verify all artifacts and run zero-call
   preflight. Any unresolved policy change returns for a decision.
5. Present exact request/token/cost/model envelope and request separate Live
   approval. No API execution follows from design approval alone.
6. Execute only the approved calibration, verify retained evidence and gate,
   preserve failures, and decide the next step from that evidence.

The builder may choose internal helper/file decomposition and concrete schema
field names within the above contracts. Changes to measured capabilities,
model panel, reliability threshold, or execution/fee approval boundaries are
not delegated. Any such proposed change must be explained before implementation.

## Builder Check

A fresh builder review raised three material questions. The proposed design
now resolves them explicitly: public reference syntax must not teach missing
API safety policies; partial/unknown collection membership must be expressible
without naming hidden members; and structural contract failures must be
separated from relational/safety semantic failures before implementation.
These resolutions are part of the approved design.
The builder recheck reported no important unanswered question. This is a
design-clarity check, not a claim that unimplemented runtime code is correct.
