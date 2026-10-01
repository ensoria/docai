# Source Traceability — Incomplete Audit

This audit covers the `0.17.1` complete candidate's `full/` and `compact/` roots. JSON locations are JSON Pointers relative to the named source. It records supported mappings and unresolved gaps; it does **not** certify source completeness or release readiness.

## Authority and Checker Boundary

The authoritative input set is the four sources bound by `source/projection-input-manifest.json`: `storefront.asyncapi.json`, `storefront-behavior.json`, `complete-contexts.json`, and `complete-representations.json`. The manifest establishes perspective, precedence, adapter mappings, and projection identity. Existing output and literal test expectations are evidence of current rendering, not additional source authority.

`tools/check-complete-fixtures.mjs` validates document structure, identity, and full/compact equivalence. `tools/tests/complete-candidate.test.mjs` checks selected source bindings and projected facts. Neither proves that every emitted semantic fact has authoritative support. A matching pair can repeat the same unsupported assertion in both profiles.

The earlier Core [source audit](../../core/v0.17.1/SOURCE-TRACEABILITY.md) documents the storefront contract mappings. Its two input files are retained in this candidate. Its Core-specific claims about source array positions, flat routing, empty contexts, all-file completeness, and `source_refs: all` do not transfer to this candidate.

## Supported Mappings

| Output scope | Input or derivation | Evidence and boundary |
|---|---|---|
| Every document's version and perspective | Manifest `#/docaiMessaging` and `#/perspective` | `storefront-service` is carried through from the source application; no counterpart inversion is used. |
| Profile and identity | Selected profile; exact manifest bytes; closed-root set digest | Same projection identity across profiles; distinct set identities; compact links back to full. |
| Source rows | Manifest `#/sources`; each source's identity/version fields | Rows are partitioned into `indexes/sources-asyncapi.md` and `indexes/sources-contexts-behavior.md`; select records by source ID, not an inherited Core array index. |
| Storefront operation and Message contracts | AsyncAPI `#/operations`, `#/channels`, `#/components/messages`; behavior `#/operationBehavior`, `#/operationFailures`, `#/requestReply` | `channels/orders.md` retains SEND/RECEIVE, primary Messages, opposite-direction Reply, field constraints, examples, behavior, and recovery. Routing is now in `indexes/operations-broad.md`. |
| Storefront conventions | AsyncAPI server/security/API facts; behavior conventions domains | `CONVENTIONS.md` retains the 15-section Core mapping, including authoritative rate-limit absence. Its source references are the storefront pair. This does not establish applicability to every synthetic operation. |
| Synthetic operation action/address and context selection | Contexts `#/operations` | Establishes `a-operation`, `m-operation`, `z-operation` action, address, and required/supplemental context IDs. Workflow IDs resolve under `workflows/`; `middle-operations` resolves under `references/`. Message identity and other missing facts are listed below. |
| Expanded Workflow purpose, operation sequence, and timeout recovery | Contexts `#/workflows/alpha-delivery` and `#/workflows/alpha-observability` | Supports the introductory purpose, ordered referenced operation headings, and recovery instruction. It does not independently supply every step annotation, precondition, or transition. |
| Separate Workflow section states | Contexts `#/workflows/state-none/sections`, `#/workflows/state-unknown/sections`, `#/workflows/state-unsupported/sections` | Each of the four sections preserves its declared state. `requiredInput` supplies unknown-marker meaning; `feature` supplies unsupported-marker meaning. Corresponding files and root aggregate knowledge/coverage markers. |
| Reference Material | Contexts `#/referenceMaterials/middle-operations` | Preserve `instructionAuthority=none`, fence info, and raw content after leading BOM removal and CRLF-to-LF normalization. Preserve decomposed Unicode and trailing newlines. The longest embedded run is four backticks, so the enclosing fence has five. |
| Forbidden context-target test inputs | Contexts `#/contextTargetCases` | Independent negative scenarios mutate routing during tests; they are not facts projected into the positive pair. |
| CSV and reusable JSON representations | Representations `#/representations/0`, `#/representations/1`, `#/representations/2` | Explicit schema, media type, required/nullability facts, field meanings, and examples support the field contracts. CSV requires the exact manifest publication mapping and trusted `complete-fixture-csv-1.0.0` decoder. |
| Opaque raw representation | Representations `#/representations/3` | `form=opaque-raw`, media type, required payload, and description authorize the raw form, 2 MiB limit, and SHA-256 integrity rule without a field table or example. |
| Tagged variant identities and examples | Representations `#/representations/4` | Discriminator `kind`, `created`/`rejected` values, examples, and payload markers are supplied. Complete field schemas are not supplied. |
| Untagged variant labels, selection, and examples | Representations `#/representations/5` | `archived`/`restored` labels, selection rule, examples, and payload markers are supplied. Complete field schemas are not supplied. |
| Compact rendering reductions | README §3.4; paired full contract; identical explicit schemas/examples for the two JSON records | One-line JSON preserves decoded values; `field_defaults` restores logical columns; backward same-file `same_as` expands to the corresponding full representation. `x-retrieval-unit: channel-file` discovers its target. Equivalence does not prove source completeness or token savings. |
| Shard bounds and selection | Emitted routing inventory and README §3.2 | Inclusive ranges are derived from shard contents. Tests cover overlapping exact loads, false positives, and semantic load-all. Token-benefit justification remains separate evidence work. |
| Convention selectors | Selected operation and required-context dependencies under README §6.1 | Current selectors and supplemental/direct whole-file fallbacks are tested. Source completeness must be resolved before certifying that `none` is a complete semantic dependency closure. |

## Open Source Gaps

These gaps were observed after commit `8168f3b`. They are prerequisites to a successful source-to-output audit, not new format requirements.

| ID | Affected source and output | Missing authority and required decision |
|---|---|---|
| `TRACE-001` | Contexts `#/operations`; `channels/alpha.md`, `channels/middle.md`, `channels/zeta.md` | Source entries contain action, channel, and contexts, but no primary Message identities or contracts. Output declares `a-message`, `m-message`, and `z-message` with payload/headers `none`. Supply explicit identities and known absence, or apply the appropriate missing-input outcomes; do not derive names or payload absence from the rendered baseline. |
| `TRACE-002` | Both synthetic sources; synthetic operation Behavior, Reply, Failure Handling, and local binding units | Repeated `none` declarations lack an explicit scenario-level absence/default policy or operation facts. Omission in these custom inputs has no documented adapter rule establishing known absence. Establish purpose, behavior, message/header exposure, and absence semantics before certifying these declarations. |
| `TRACE-003` | Contexts `#/workflows/alpha-delivery` and `#/workflows/alpha-observability`; corresponding expanded Workflow files | Source lacks the emitted preconditions, complete carried-value step annotations, and explicit transition models (`alpha.ready → alpha.sent → middle.recorded`; `trace.pending → trace.recorded`). Supply authoritative workflow facts; existing output/test literals cannot serve as their provenance. |
| `TRACE-004` | Representations `#/representations/4/variants` and `#/representations/5/variants`; tagged/untagged field tables | Examples and variant identity do not establish field type domains, Required/Presence, field nullability, or descriptions. Supply explicit schemas/field semantics. A string example alone cannot establish that every valid value is a non-null string or that the field is always present. |
| `TRACE-005` | Representation schemas versus `channels/representations.md` field tables | CSV and reusable JSON source schemas specify `additionalProperties: false`, but projected tables contain only child rows and no explicit closed-root rule. Confirm the wire-adapter boundary for CSV and project the JSON root constraint faithfully. Full/compact equality does not detect equal omissions. |

## Resolution and Refresh

The recommended resolution is to define the missing synthetic fixture facts explicitly in the authoritative inputs, independently review them as the intended scenario, and then align the projections and add source-aware regression checks. Do not silently copy output assertions into source and call that independent validation. The alternative is to model these facts as genuinely missing and project the prescribed unknown/unprojected outcomes; that changes the intended positive advanced-structure scenarios.

Source or projection-policy changes require manifest digest rebinding and restamping both roots. Changes to this audit alone require neither. Keep Task 12 source traceability incomplete until the gaps are resolved and the completed matrix is reviewed. Focused invalid corpus, token accounting, and publication review remain later tasks.
