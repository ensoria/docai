# Complete Surface Coverage Inventory — 0.17.1 Candidate

Inventory audit: 2026-10-31, baseline `c0faa61`. Initial recipe corpus: 2026-11-01, baseline `4412770`. This is a requirements and evidence inventory with a partial executable corpus, **not a completed conformance corpus or publication approval**. The default checker still validates the positive candidate pair; explicit `--corpus` mode executes `cases.json`.

## Scope and evidence rules

The authority is [README §8](../../../README.md#8-compliance-checklist), including the three complete-surface corpus paragraphs, the first-1.x reader-compatibility paragraph, and the existing Core requirements. The [Core inventory](../../core/v0.17.1/COVERAGE.md) remains closed for its own published scope: 264 cases, 193 invalid, 71 valid. Its `R8-CORE-001`–`049` evidence is reusable only for the named Core facet; it does not establish advanced-surface compatibility.

The complete candidate has paired 17-path roots and finite source/manifest evidence in [SOURCE-TRACEABILITY](SOURCE-TRACEABILITY.md). [cases.json](cases.json) now pins those 39 base files and declares 21 recipes: six valid and fifteen invalid, with positive and negative witnesses for each of the fifteen complete diagnostic rules. Three recipes validate unchanged whole sets/pair; eighteen use the explicitly task-scoped mutation layer. These counts do not close any of the 38 publication requirements below.

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

1. The initial manifest and [complete dispatcher][complete-dispatcher] reuse [generic runner][runner] expectation matching and its one-primary audit, with the tool's trusted rule catalog. [Core dispatcher][core-dispatcher] covers different Core kinds; its `operation-profile-pair` branch is not the complete pair validator. [Complete CLI][checker] retains the one-pair candidate-specific source/policy gate and adds a separate explicit corpus mode. The remaining work is requirement-facet completion, not replacement of the candidate gate or relabeling its success as complete publication coverage.
2. Separate ordinary set/pair cases, source projection/generation outcomes, and synthetic reader-compatibility cases. Ordinary rejection, source unrepresentability, and generation failure are not interchangeable. Every invalid case needs one primary responsibility, expected rule/outcome and documented cascades. Trusted adapter mappings remain explicit, never inferred from emitted examples.
3. Materialize reproducible valid/invalid evidence: immutable versioned roots or explicit deterministic fixture recipes with exact bases and assertions. Use the existing restamper only for owned staging copies and declared manifests; identity validity must not mask the intended failure. Do not copy or relabel Core cases without declaring the exact reused requirement and compatible validation path.
4. Bind every required facet above to case IDs, rule/outcome assertions and the executable coverage check. `cases.json` contains initial case/facet links; every row has `facets_complete:false` because its facet inventory is still partial. Closing a row requires a reviewed exhaustive facet declaration and successful valid/invalid witnesses for every facet, not one arbitrary representative. A coverage result distinguishes 38 applicable open rows from three conditional release obligations; a zero on a subset is not complete readiness.
5. Synchronize first-1.x reader behavior and the new Headers constraint with Task 15's versioned corpus and normative changes. Preserve 0.17.1's published meaning. Task 14 supplies total-task evidence and accounting failures before release acceptance; it is not waived by closing grammar rows.

## Delivery grouping and estimate

The inventory and initial group (a), manifest/dispatcher/coverage gate plus profile, Workflow, Reference and convention representatives, now exist. Remaining Task 13 groups are (b) source/contract promotion including adapters, bindings, variants and exact JSON; (c) uncovered naming/default/representability/generation outcomes; (d) first-1.x synthetic cases and full facet closure with release-version dependencies. Groups (b)/(c) may each require an extra coherent checkpoint after their per-feature TDD findings: **3–5 remaining Task 13 checkpoints**. Combined with Task 14 (2–3), Task 15 (1–2) and Task 16 (1), the provisional total is **7–11**. This is not a deadline or upper bound; all 38 publication rows remain open.

### Recipe schema and validation layers

`cases.json` schema 1 has `docai_messaging:0.17.1`, `scope:complete-candidate`, `base_files` (exact SHA-256 bindings), 41 requirement declarations, and case entries. Each case names `id`, `kind`, `path`, `expected`, `expected_rule_ids`, `rule_ids` and `facets`. Kinds are `complete-pair`, `complete-full` and `complete-compact`. An invalid case declares one primary rule; valid entries declare none. The declared `rule_ids` are evidence labels, not inferred branch coverage or proof of every normative facet.

Each JSON recipe has `mode`, `changes`, `assertions`. The runner first verifies complete base membership, every pin, both identities and whole-pair validity with explicit trusted example adapters. It replays changes in an owned temporary copy, reloads the documents using existing parsers and compares actual facts against literal JSON-pointer assertions. Inputs are never edited. Replacement anchors must occur exactly once; `add` requires an absent file, and `remove` requires an existing file. Only full/compact document paths are admitted; escaping paths, symlinks, unknown fields, duplicate JSON names and invalid UTF-8 fail. Numeric recipe literals are checked as exact safe integers before native conversion; exact numeric source representations remain strings, without silent narrowing. Unpaired surrogates in text to be written fail before UTF-8 encoding; valid Unicode pairs and literal escaped source text are preserved.

- `whole-set`: no changes; validates identities and the complete selected set/pair.
- `task-scoped`: nonempty changes after the pinned base passed whole-set validation. Checks grammar, pair contracts or retrieval facts without asserting a new checksum for the changed view. These are executable semantic fixtures, **not freshly stamped standalone document sets**. They do not replace identity, source-aware or release-publication gates.

Commands (all preserve corpus input bytes):

```sh
node docai-messaging/tools/check-complete-fixtures.mjs
node docai-messaging/tools/check-complete-fixtures.mjs --corpus docai-messaging/fixtures/complete-candidates/v0.17.1
node docai-messaging/tools/check-complete-fixtures.mjs --corpus docai-messaging/fixtures/complete-candidates/v0.17.1 --require-complete
```

The first command remains the finite candidate source/policy check. The second currently reports 21 passed, 0 failed, 38 open complete requirements and three conditional release obligations. The third **must exit nonzero** while applicable rows are open. Successful declared facet witnesses alone never certify publication readiness: Task 14/15/16, human review and first-1.x requirements remain separate. Later source-scenario and reader-compatibility kinds need an explicit design, not arbitrary executable recipe code.

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
[complete-dispatcher]: ../../../tools/lib/complete-fixture-validator.mjs
