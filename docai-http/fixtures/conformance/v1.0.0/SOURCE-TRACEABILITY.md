# Source Traceability

This file records the source-fixture audit for the intended DocAI HTTP `1.0.0`
stable conformance corpus.

## Decision

Source fixtures remain traceability evidence for `1.0.0`; they are not a
source-to-projection validator contract. The stable release does not require a
public source-to-projection validator before final stable `v1.0.0` publication.

Why:

- The stable compatibility promise is the DocAI HTTP document format and the
  conformance corpus, not a generator implementation API.
- A public source-to-projection validator would need its own input model,
  diagnostics model, versioning rules, and compatibility boundary.
- The current corpus records an authoritative input-set manifest, its OpenAPI
  input, pass-through behavior input, and recursive-schema fallback inputs.
- Adding a validator boundary immediately before final stable `v1.0.0`
  publication would broaden the stable promise more than the fixture evidence
  requires.

## Source Fixtures

| Source fixture | Traceability role | Conformance evidence |
|---|---|---|
| `source/complete-input-set.yaml` | Authoritative input-set manifest and revision used by the full and compact metadata stamps. | Every standard file in `valid/full/` and `valid/compact/`. |
| `source/complete-openapi.yaml` | Authoritative source for HTTP operations and structured request and response schemas. | Resource endpoint headings, parameters, body fields, response fields, and OpenAPI-derived examples in `valid/full/` and `valid/compact/`. |
| `source/complete-behavior.yaml` | Authoritative pass-through source for conventions, errors, idempotency, workflow recovery, webhook delivery, multipart constraints, and other client behavior not present in OpenAPI. | `CONVENTIONS.md`, resource Behavior and Errors sections, `workflows/checkout.md`, `webhooks/payment-completed.md`, and multipart details in `resources/documents.md`. |
| `source/recursive-direct-openapi.yaml` | Authoritative source for direct recursive-schema fallback. | `focused/valid/recursive-direct-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |
| `source/recursive-indirect-openapi.yaml` | Authoritative source for indirect recursive-schema fallback. | `focused/valid/recursive-indirect-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |

## Complete-Set Fact Matrix

| Client-visible fact class | Authoritative input | Projected files |
|---|---|---|
| Operations, paths, parameters, media types, and structured schemas | `source/complete-openapi.yaml` | `valid/full/resources/`, `valid/compact/resources/` |
| Environments, versioning, authentication, request formats, data representation, and common errors | `source/complete-behavior.yaml` | Full and compact `CONVENTIONS.md`; INDEX convention routing |
| `Idempotency-Key`, replay identity, retention, conflicting reuse, and no-key behavior | `source/complete-behavior.yaml` `http_semantics.idempotency` | Full and compact `CONVENTIONS.md`; affected resource Behavior and Errors sections; checkout workflow |
| Endpoint side effects, preconditions, authorization, and endpoint errors | `source/complete-behavior.yaml` `operations` | Full and compact resource files |
| Multipart filename, content-type, boundary, and size constraints | `source/complete-behavior.yaml` `file_transfer` and OpenAPI multipart schema | Full and compact `resources/documents.md` |
| Checkout values, state transitions, ambiguous outcomes, and recovery | `source/complete-behavior.yaml` `workflow.checkout` | Full and compact `workflows/checkout.md`; related resource links |
| Webhook receiver, retry, deduplication, ordering, and event-specific delivery | `source/complete-behavior.yaml` `webhook_delivery` | Full and compact `CONVENTIONS.md` and `webhooks/payment-completed.md` |
| Direct and indirect recursive-schema fallback | Recursive OpenAPI source fixtures | Focused recursive valid and invalid fixtures |

## Checker Boundary

`tools/check-conformance-fixtures.mjs` checks the corpus-specific DocAI HTTP
expectations: metadata version, stable conformance expectation labels, full/compact
profile pairing, required standard paths, focused valid/invalid snippets, coverage
references, input-set manifest references, source revision consistency, and required
source fixture presence.

It does not prove that every field in the DocAI HTTP projection was mechanically
generated from the OpenAPI source. That deeper source-to-projection check remains
future work unless the project deliberately defines a reusable validator boundary.

## Source Completeness Result

The fact matrix found client-visible conventions, retry behavior, workflow recovery,
webhook delivery, and multipart constraints that were not present in the OpenAPI-only
source claim published in `v1.0.0-rc.1`. The `complete-input-set.yaml` manifest and
`complete-behavior.yaml` pass-through input close those provenance gaps for `rc.2`.

No known client-visible fact in the corrected full or compact complete set lacks an
authoritative input after this change. Before final stable `v1.0.0` publication, add
another source input only if a conformance document depends on behavior not represented
by the manifest's OpenAPI and pass-through behavior files.

## Refresh Rule

If the conformance document content changes beyond metadata, paths, expectation
labels, or documentation-only traceability notes, repeat this audit and decide
whether the live LLM, token-load, or OpenAPI comparison evidence must also be
refreshed.
