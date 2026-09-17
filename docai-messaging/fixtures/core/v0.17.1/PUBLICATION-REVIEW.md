# Compatibility Core Publication Review

Review date: 2026-09-17

This review evaluates the DocAI Messaging `0.17.1` Compatibility Core corpus as a publication candidate. It does not promote the repository publication label by itself and does not claim compatibility for the complete generator surface.

## Review Boundary

The reviewed release evidence is:

- `PUBLICATION.json`, the trusted out-of-band publication-scope record;
- `source/projection-input-manifest.json`, with exact SHA-256 digest `d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480`;
- `valid/full/`, the contract-complete full-profile document set;
- `cases.json`, the focused valid and invalid corpus;
- `COVERAGE.md`, the README §8 coverage matrix;
- `SOURCE-TRACEABILITY.md`, the source-to-output semantic audit; and
- `tools/check-core-fixtures.mjs`, the deterministic read-only gate.

Inputs under `source/focused/` are evidence for individual Core boundaries. They are not inputs to `valid/full/` and do not expand its client-visible contract.

## Out-of-Band Publication Metadata

| Field | Reviewed value |
|---|---|
| Publication scope identity | `docai-messaging-core-fixture-publication` |
| Publication scope version | `1.0.0` |
| Compatibility scope | `compatibility-core` |
| DocAI Messaging version | `0.17.1` |
| Published profile | `full` |
| Projection manifest | `source/projection-input-manifest.json` |
| Projection manifest SHA-256 | `sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480` |

The publication-scope identity and version equal the projection manifest's `publicationPolicy`. The checker recomputes the manifest digest and requires every adapter mapping below to match the manifest's exact `(class, target, ruleVersion)` tuple.

| Adapter class | Target identity | Rule version |
|---|---|---|
| `behavior-source` | `behavior-configuration@fixture-1` | `1.0.0` |
| `header-encoding` | `kafka-record-headers;value-encoding=utf-8` | `1.0.0` |
| `payload-wire` | `application/json` | `docai-messaging-0.17.1` |
| `schema` | `application/vnd.aai.asyncapi+json;version=3.1.0` | `docai-messaging-0.17.1` |
| `source` | `AsyncAPI 3.1.0` | `1.0.0` |

These adapter identities are producer and source-aware-validator inputs. An ordinary reader consumes the normalized DocAI document set and does not need to reconstruct or support these source adapters.

## Format Compliance

Result: **pass** for the reviewed corpus.

The read-only Core checker validates all 264 manifest cases, including 193 invalid cases with exactly one expected primary concern. It rejects invalid metadata, identity digests, INDEX routing, marker propagation, unused Core rules, incomplete coverage rows, missing publication metadata, and publication metadata that drifts from the projection manifest. Every current `R8-CORE-*` row is `covered`, every Core catalog rule has manifest or matrix evidence, and the valid full set passes closed-root and identity validation.

This result is a syntax and conformance judgment. It does not by itself establish contract completeness or implementation readiness.

## Contract Completeness

Result: **pass** for `valid/full/`.

`SOURCE-TRACEABILITY.md` accounts for every client-visible full-set fact using the two authoritative main sources, the projection manifest, or an identified normalized-format derivation. Both source operations are routed; no source operation is left unprojected; required and supplemental context are explicitly `none`; Workflows is explicitly `none`; and every file reports `coverage: complete` and `knowledge: complete` without an `unknown` or `unsupported` marker. The closed root contains only the required root, conventions, and channel retrieval units.

This judgment applies to the reviewed `valid/full/` bytes and its bound projection manifest. It does not assert that every focused valid fixture is independently contract-complete, because many intentionally isolate one grammar or incomplete-information boundary.

## Reader-Relative Readiness

Result: **conditional pass** for a reader and target runtime that satisfy all of the following reviewed conditions:

- exact support for DocAI Messaging `0.17.1`, the `full` profile, and the Compatibility Core structures used by `valid/full/`;
- trusted support for publication scope `docai-messaging-core-fixture-publication` version `1.0.0`;
- UTF-8 JSON handling for `application/json` with the schemas projected inline and no runtime schema lookup;
- Kafka protocol version `3.6.0`; and
- Kafka record-header exposure by documented logical name with UTF-8 values.

For such a reader, the normalized full set has no incomplete marker, advanced required context, or visible unsupported runtime requirement that blocks the two indexed operations. A reader lacking the exact publication scope, a required Core structure, or a listed target-runtime capability must report the relevant set or operation not ready. Supporting the producer-side adapter mappings is required only for generation or source-aware validation, not for ordinary reading.

This is not a universal readiness claim and does not cover `compact`, selective conventions, workflows, Reference Material, non-JSON representations, polymorphic variants, or any other complete-surface feature.

## Reviewer Result

- [x] Format compliance passed independently of completeness and readiness.
- [x] `valid/full/` contract completeness passed against source traceability.
- [x] Reader-relative readiness passed only under the declared reader and runtime conditions.
- [x] Publication-scope and adapter mapping identities and versions are recorded out of band and checker-bound to the projection manifest.
- [x] No Compatibility Core publication blocker was found within this review boundary.
- [x] Complete-surface compatibility is not claimed.
- [x] Repository publication-label promotion remains a separate change set.

Any change to normative meaning, fixture expectation, checker rule, publication metadata, projection-manifest bytes, or a client-visible `valid/full/` fact invalidates this review and requires the release to stop pending version and fixture-version reassessment.
