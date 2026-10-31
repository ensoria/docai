# Complete Surface Coverage Inventory — 0.17.1 Candidate

Audit date: 2026-10-31. Baseline: `c0faa61`. This is a requirements and evidence inventory, **not a completed conformance corpus or publication approval**. The current checker validates one positive candidate pair; it does not consume this table or a complete-surface `cases.json`.

## Scope and evidence rules

The authority is [README §8](../../../README.md#8-compliance-checklist), including the three complete-surface corpus paragraphs, the first-1.x reader-compatibility paragraph, and the existing Core requirements. The [Core inventory](../../core/v0.17.1/COVERAGE.md) remains closed for its own published scope: 264 cases, 193 invalid, 71 valid. Its `R8-CORE-001`–`049` evidence is reusable only for the named Core facet; it does not establish advanced-surface compatibility.

The complete candidate currently has paired 17-path roots and finite source/manifest evidence in [SOURCE-TRACEABILITY](SOURCE-TRACEABILITY.md). It has no complete-surface `cases.json`, `focused/valid/`, or `focused/invalid/`. This file supplies the previously missing coverage inventory; adding it does not fill those other gaps.

Evidence below means an existing implementation or regression was located and inspected, not that every listed subcase passed a new audit. All 38 `R8-COMPLETE` rows remain **open for versioned publication evidence**. An existing unit test, a catalog rule, a positive candidate, and a published valid/invalid fixture are different evidence. Partial Core reuse and unconfirmed implementation gaps are stated explicitly. No row is `covered` merely because the full test suite passes.

Paragraph locators in §8:

- **A:** starts “Before a release advertises” — the complete-surface valid/invalid inventory.
- **B:** starts “The complete-surface corpus must validate” — pair-equivalence algorithm.
- **C:** starts “The complete-surface corpus must also cover every workflow” — workflow grammar and token accounting.
- **X:** starts “Beginning with the first 1.x” — synthetic future-minor reader compatibility.

IDs are inventory requirements, not diagnostic rule IDs. The [rule catalog](../../rules.json) currently contains 67 Core rules and 15 complete rules; the complete rules cover `DM-WF-001`–`006`, `DM-REF-001`–`003`, `DM-CONV-005`, and `DM-PROFILE-001`–`005`. Advanced obligations can also use Core diagnostics or source-scenario outcomes. Diagnostic coverage alone cannot replace requirement coverage.

## Complete-surface requirements

Every row requires explicit valid and invalid versioned cases for its applicable facets, expected diagnostics/outcomes, and a runnable checker binding. Token results remain owned by Task 14; release-specific constraints remain owned by Task 15. Abbreviations in the evidence column resolve to exact repository files below.

| ID | §8 locator and required facets | Existing evidence / remaining boundary |
|---|---|---|
| R8-COMPLETE-001 | A: paired full/compact roots, profile discovery/fallback, unknown profiles | [pair tests][pair], Core `007`; fallback/unsupported-profile scenarios need explicit reader expectations as well as ordinary invalid-metadata cases. |
| R8-COMPLETE-002 | A: path and direct/sharded routing-form parity for Sources, Operations, Workflows, Unprojected Operations | [pair tests][pair], [workflow routing tests][workflow-routing], Core `005`, `009`, `012`; publish each catalog kind, matching and drifting pairs. |
| R8-COMPLETE-003 | A: direct/sharded Workflows; display title distinct from routing name; empty/duplicate normalized names; exact/semantic selection, false positives, load-all | [workflow routing tests][workflow-routing], [workflow body tests][workflow-body]; current candidate uses direct Workflow routing, so it cannot prove the sharded branch. |
| R8-COMPLETE-004 | A: Reference Material boundaries, embedded backticks, structural escape, non-UTF-8, arbitrary stamped Markdown rejection | [Reference tests][reference], [source-section tests][sections], Core `004`, `031`; publish bytes/fence/ownership positives and negatives. |
| R8-COMPLETE-005 | A: reply-prefixed operation routing; whole-Reply unknown message-set and identity forms | [Core corpus tests][core-tests], [document tests][document], Core `022`, `023`, `043`, `044`; retain the distinct primary-unprojection versus whole-Reply outcomes. |
| R8-COMPLETE-006 | A: valid/duplicate/refactoring-stable overrides; normal derived names; collisions with derived name, source ID, override; colliding 128-bit derived candidates expand to 256 bits (26 to 52 base32 characters); post-expansion uniqueness failure and complete-digest collision failure | **Implementation/evidence gap to resolve.** The finite [manifest gate][manifest] requires empty `stableNameOverrides`; no stable-name derivation/expansion implementation or dedicated tests were located. An expanded derived name still colliding with an override or source ID must fail independently of complete-digest equality. Unprojected grouping collisions in Core `032` are a different rule. Do not call them naming evidence. |
| R8-COMPLETE-007 | A: every binding scope, including reply and failure messages | [Bindings tests][bindings], [document tests][document], Core `049`; recent grammar/source-absence fixes are regressions, not a versioned matrix of every binding adapter/scope outcome. |
| R8-COMPLETE-008 | A: nullable/conditionally required headers and fields | [document tests][document], Core `019`, `020`; promote named direction/root/ancestor cases and add advanced combinations where needed. |
| R8-COMPLETE-009 | A: deterministic input precedence and generation-stopping conflicts | Core source-expectation helpers in [Core validators][core-code], [document tests][document]; the candidate binds a finite manifest policy. Arbitrary source merge/conflict resolution is not certified; fixture outcomes must derive from authoritative inputs, not supplied expected selections. |
| R8-COMPLETE-010 | A: every directly representable §3.6 feature; satisfiable/empty constraint combinations; constraint-valid illustrative-example unknowns; generator example-production/validation incapability fails generation | [Core validators][core-code], [document tests][document], Core `024`–`026`; per-feature mapping is still required. Existing default/format and numeric-interval helpers do not prove all source-schema features. |
| R8-COMPLETE-011 | A: unsupported conditionals, pattern-key maps, tuples, recursion, unknown keywords and dialects | Generic `representable:false` fallback in [Core validators][core-code] is partial evidence only. Dedicated feature recognition and smallest-applicable unsupported fixtures were not established by this audit; test each actual source construct. |
| R8-COMPLETE-012 | A: `contentType` versus `schemaFormat` | [adapter tests][adapters], [source projection tests][source-projection], Core `016`, `027`, `036`, `039`, `040`, `049`; preserve schema/wire target independence and emitted media identity. |
| R8-COMPLETE-013 | A: compatible/incompatible registered/unregistered schema and wire adapters, plus applicable header/binding adapter decisions | [adapter tests][adapters], Core `028`, `036`, `049`; exact tuple, absent/duplicate mapping, rule-version/digest and ordinary-reader boundaries must survive corpus promotion. |
| R8-COMPLETE-014 | A: valid opaque raw binary; reject structured content disguised as raw binary | [source projection tests][source-projection], [document tests][document], Core `027`; candidate has one positive opaque-raw representation. |
| R8-COMPLETE-015 | A: API contract version distinguished from AsyncAPI specification version | Core `005`, `037`, [Core corpus tests][core-tests], [source audit][source-audit]; retain separate catalog values and authoritative missing-identity/version outcomes. |
| R8-COMPLETE-016 | A: safe and rejected source examples | Core `029`, `031`, [Core corpus tests][core-tests]; distinguish safe synthetic replacement from disclosure and invalid source examples. |
| R8-COMPLETE-017 | A: authorized non-secret contract metadata and safely withheld sensitive facts | Core `029`, [Core validators][core-code], [Core corpus tests][core-tests]; mandatory unsafe structural values must still fail generation. |
| R8-COMPLETE-018 | A: table escape parity | [table tests][tables], [pair tests][pair], Core `035`; decoded logical cells and structural pipe/backslash parity need published positive/negative cases. |
| R8-COMPLETE-019 | A: selective convention dependency closure over required workflows; supplemental/direct Workflow whole-file fallback; token costs | [convention tests][conventions], [context audit tests][contexts]; publish retrieval expectations. **Task 14** supplies measured workflow-triggered whole-CONVENTIONS costs. |
| R8-COMPLETE-020 | A: valid/invalid schema, Server Variable and Channel Parameter defaults, including `Presence=optional` | Core `024`, [Core validators][core-code], [document tests][document] supply partial schema-default evidence. Dedicated Server Variable / Channel Parameter default projection evidence was not located; do not infer it from field defaults or schema annotations. |
| R8-COMPLETE-021 | A: `field_defaults` reconstruction; unique logical ordering; duplicate/out-of-order/unknown/inapplicable columns; empty-string `Meaning=none` | [pair tests][pair], [logical-line tests][logical-lines]; promote SEND/RECEIVE, Headers/Payload/Reply, suffix and malformed/default-value cases. No token-savings claim follows from reconstruction. |
| R8-COMPLETE-022 | A: valid/invalid `same_as` targets; both field-collection unknown forms ineligible; paired-full canonical comparison and retrieval-unit discovery | [pair tests][pair], [logical-line tests][logical-lines]; preserve backward/local/direct eligibility, direction and failure-shape/raw restrictions. |
| R8-COMPLETE-023 | A: required versus supplemental Workflow/Reference retrieval; cross-operation sequencing, timeout, transitions and recovery in required Workflow; reusable schemas/domain objects inline | [convention tests][conventions], [context audit tests][contexts], [Reference tests][reference], finite candidate; publish selection and placement evidence, not merely valid links. |
| R8-COMPLETE-024 | A: non-reply correlation identifiers | [document tests][document] and [source audit][source-audit] provide envelope/correlation context; a dedicated versioned non-reply correlation case remains required. Do not substitute a reply correlation case. |
| R8-COMPLETE-025 | A: tagged markers with JSON strings, escaping, numbers, booleans; invalid delimiters; discriminator/const mismatch; reject tagged-to-untagged fallback | [document tests][document], [exact JSON][json]; candidate tagged variants are positive examples only. Publish every listed marker-value class and failure outcome. |
| R8-COMPLETE-026 | A: constrained untagged labels | [document tests][document], finite candidate untagged variants; exact label grammar/order and tagged-delimiter prohibition need versioned pairs. |
| R8-COMPLETE-027 | A: polymorphic missing-field-name fallback to representation-local field collection | Core `017`, `018` prove related non-polymorphic forms only. Dedicated polymorphic source fallback evidence was not established; retain the whole-representation boundary rather than invent a partial variant. |
| R8-COMPLETE-028 | A: exact JSON across full/compact examples, same-as, variants, constraints and validation; `1`/`1.0`/`1e0`; unequal values beyond IEEE754; arbitrary exponents/magnitude; object versus array order; exact unnormalized strings/names; duplicate names | [exact JSON][json], [pair tests][pair], [document tests][document]; publish a cross-surface matrix, not only parser unit tests. |
| R8-COMPLETE-029 | A: §6.2 artifact covering every routing form, considered/false-positive shards by kind, per-task totals, nearest-rank p50/p95/max, fallback costs, disclosed regressions; cache evidence only if claimed | **Task 14 open.** [Source-shard evidence tests][token-tests] are narrower than complete total-task evidence. No complete `TOKEN-EVIDENCE.md` or evaluation results exist. No cache savings claim is planned. |
| R8-COMPLETE-030 | B: matching pairs accept prescribed profile-link/identity exclusion, permitted x-extensions, adapter serialization, field-default and same-as expansion | [pair tests][pair], [adapter tests][adapters], [logical-line tests][logical-lines]; exclusions apply after constituent validity, without hiding standard contracts. |
| R8-COMPLETE-031 | B: mismatching pairs reject invalid example fence/adapter rendering and changes to standard headings, markers, fixed values, logical cells, normalized prose, canonical examples, order, omission or addition | [pair tests][pair]; publish each mismatch class with correct primary/cascade diagnostics and independently valid pair members where appropriate. |
| R8-COMPLETE-032 | B: compact `x-retrieval-unit` metadata is not contract content | [pair tests][pair], candidate JSON reuse; demonstrate both required retrieval discovery and exclusion from contract comparison. |
| R8-COMPLETE-033 | C: every Workflow section state, including expanded-only list/table constraints | [workflow body tests][workflow-body]; current candidate section-state representatives do not replace invalid corpus cases. |
| R8-COMPLETE-034 | C: Workflow introductory paragraph; one/two source-level sentences; missing, multi-line/paragraph, unterminated, three-plus; Japanese adjacency and literal URL/abbreviation/code terminators | [workflow body tests][workflow-body], Core `034` only for related operation prose; publish Workflow-specific source-line cases. |
| R8-COMPLETE-035 | C: generation failure for absent/unpublishable/unrepresentable purpose or successful outcome | Finite [Workflow label audit][labels] checks known source labels; it is not a general missing-purpose/outcome generation rule. Dedicated source scenarios/outcomes remain required. |
| R8-COMPLETE-036 | C: whole-Workflow/section deviations, ordering, all permitted core states; missing states and misplaced/unsorted deviations invalid | [workflow body tests][workflow-body]; promote state/deviation cross-cases with their expected `DM-WF` diagnostics. |
| R8-COMPLETE-037 | C: valid one/multiple-item Preconditions and Failure/Recovery lists; reject empty/nested/continued/multiline items, headings, tables and fences; each item one `- ` source line | [workflow body tests][workflow-body]; preserve physical-line grammar in versioned positives and negatives. |
| R8-COMPLETE-038 | C: parser/retrieval instruction tokens, tool-result context and total input; valid/invalid preinstalled-reader accounting applied symmetrically to DocAI and baseline | **Task 14 open.** Must be an executable accounting assertion and result artifact; table-cell or character counts are not equivalent evidence. |

## First-1.x and approved release obligations

These three rows are tracked separately; they are not valid newer-pre-1.0 inputs and do not silently tighten 0.17.1.

| ID | Required cases | Status / owner |
|---|---|---|
| R8-1X-001 | X: a supported-major reader accepts a newer-minor unknown standard metadata key after known keys and before x-keys; rejects invalid names/placement and duplicates; exact older/same-minor and unsupported-major boundaries | Open; Task 13 synthetic reader corpus, enabled with the first 1.x implementation-target publication in Task 15. [metadata parser][metadata] currently rejects unknown standard keys; no explicit newer-minor reader-support policy was located. |
| R8-1X-002 | X: reader-known standard table prefix, contiguous future-standard suffix, final x-suffix; older reader ignores unknown internal suffix order, rejects future columns splitting known prefix or x before future; later declared-version validator enforces defined order | Open; Task 13 / 15. Existing Core `035` covers x-suffix boundaries, not this future-standard-column contract. No later-minor producer ordering is asserted before such a minor exists. |
| RELEASE-HDR-001 | User-approved first-1.0.0 Header Name uniqueness: duplicate same-value/conflicting rows in one logical table; SEND/RECEIVE/Reply/failure shapes and compact reconstruction; same name across Messages valid; exact decoded comparison | Open; Task 13 evidence and Task 15 normative/version/checker synchronization. No new 0.17.1 prohibition. Case folding and Unicode normalization must not be introduced implicitly. |

## Infrastructure gaps and completion contract

1. Add a complete-surface manifest and case dispatcher. [Generic runner][runner] already loads `cases.json` and compares expected diagnostic sets. [Core dispatcher][core-dispatcher] covers Core kinds; its `operation-profile-pair` branch is not the complete pair validator. [Complete CLI][checker] currently loads one pair and candidate-specific source/policy gates, without a corpus manifest or coverage audit. Reuse these responsibilities; do not replace the existing candidate gate or label its success “all complete cases passed”.
2. Separate ordinary set/pair cases, source projection/generation outcomes, and synthetic reader-compatibility cases. Ordinary rejection, source unrepresentability, and generation failure are not interchangeable. Every invalid case needs one primary responsibility, expected rule/outcome and documented cascades. Trusted adapter mappings remain explicit, never inferred from emitted examples.
3. Materialize reproducible valid/invalid evidence: immutable versioned roots or explicit deterministic fixture recipes with exact bases and assertions. Use the existing restamper only for owned staging copies and declared manifests; identity validity must not mask the intended failure. Do not copy or relabel Core cases without declaring the exact reused requirement and compatible validation path.
4. Bind every required facet above to case IDs, rule/outcome assertions and an executable coverage check. The current table has no complete case IDs because none exist yet. Closing a row requires every named facet, not one arbitrary representative. A coverage result must distinguish applicable open rows, Task 14 dependencies and release-version conditions; a zero on a subset is not complete readiness.
5. Synchronize first-1.x reader behavior and the new Headers constraint with Task 15's versioned corpus and normative changes. Preserve 0.17.1's published meaning. Task 14 supplies total-task evidence and accounting failures before release acceptance; it is not waived by closing grammar rows.

## Delivery grouping and estimate

This audit closes the inventory deliverable only. Proposed remaining Task 13 groups are: (a) manifest/dispatcher/coverage gate plus profile, Workflow, Reference and convention fixtures; (b) source/contract promotion including adapters, bindings, variants and exact JSON; (c) uncovered naming/default/representability/generation outcomes; (d) first-1.x synthetic cases and full closure with release-version dependencies. Groups (b)/(c) may each require an extra coherent checkpoint after their per-feature TDD findings: **4–6 remaining Task 13 checkpoints**. Combined with Task 14 (2–3), Task 15 (1–2) and Task 16 (1), the overall provisional **8–12** remains unchanged. It is not a time estimate or upper bound. The inventory turns uncertainty into named work; it does not justify subtracting a checkpoint while newly explicit gaps are unresolved.

The next implementation proposal is group (a); its exact fixture schema, rules, admission/coverage behavior and tests need a concrete design before implementation. No new behavior, fixture format or release sequence is approved by this inventory.

[pair]: ../../../tools/tests/complete-profile-pair.test.mjs
[workflow-routing]: ../../../tools/tests/complete-validator.test.mjs
[workflow-body]: ../../../tools/tests/complete-workflow-body-validator.test.mjs
[reference]: ../../../tools/tests/complete-reference-material-validator.test.mjs
[sections]: ../../../tools/tests/complete-source-sections.test.mjs
[conventions]: ../../../tools/tests/complete-convention-retrieval.test.mjs
[contexts]: ../../../tools/tests/complete-storefront-context-audit.test.mjs
[adapters]: ../../../tools/tests/complete-example-adapters.test.mjs
[source-projection]: ../../../tools/tests/complete-source-projection.test.mjs
[bindings]: ../../../tools/tests/core-binding-extensions.test.mjs
[document]: ../../../tools/tests/document-set.test.mjs
[core-tests]: ../../../tools/tests/core-corpus.test.mjs
[core-code]: ../../../tools/lib/validators/core.mjs
[manifest]: ../../../tools/lib/complete-manifest-contract.mjs
[source-audit]: ../../../tools/lib/complete-candidate-source-audit.mjs
[labels]: ../../../tools/lib/complete-workflow-label-audit.mjs
[tables]: ../../../tools/tests/tables.test.mjs
[json]: ../../../tools/tests/json-value.test.mjs
[logical-lines]: ../../../tools/tests/complete-compact-line-endings.test.mjs
[token-tests]: ../../../tools/tests/source-shard-token-evidence.test.mjs
[metadata]: ../../../tools/lib/metadata.mjs
[runner]: ../../../tools/lib/fixture-runner.mjs
[core-dispatcher]: ../../../tools/lib/core-fixture-validator.mjs
[checker]: ../../../tools/check-complete-fixtures.mjs
