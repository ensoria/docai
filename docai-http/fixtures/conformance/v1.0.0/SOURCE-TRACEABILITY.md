# Source Traceability

This file records the source-fixture audit for the DocAI HTTP `1.0.0`
stable conformance corpus.

## Decision

Source fixtures remain traceability evidence for `1.0.0`; they are not a
source-to-projection validator contract. The stable release does not include a
public source-to-projection validator.

Why:

- The stable compatibility promise is the DocAI HTTP document format and the
  conformance corpus, not a generator implementation API.
- A public source-to-projection validator would need its own input model,
  diagnostics model, versioning rules, and compatibility boundary.
- The current corpus records an authoritative input-set manifest, its OpenAPI
  input, pass-through behavior input, and recursive-schema fallback inputs.
- Adding a validator boundary to `1.0.0` would broaden the stable promise more
  than the fixture evidence requires.

## Source Fixtures

| Source fixture | Traceability role | Conformance evidence |
|---|---|---|
| `source/complete-input-set.yaml` | Authoritative input-set manifest and revision used by the full and compact metadata stamps. | Every standard file in `valid/full/` and `valid/compact/`. |
| `source/complete-openapi.yaml` | Authoritative source for HTTP operations; request, success-response, webhook, and error schemas; response media types; `Location`; defaults; and schema constraints. | Resource endpoint headings, parameters, request and response fields, caller-visible response headers, error shapes, and OpenAPI-derived examples in `valid/full/` and `valid/compact/`. |
| `source/complete-behavior.yaml` | Authoritative pass-through source for conventions, error handling and field usage, idempotency, workflow recovery, webhook delivery and header wire rules, multipart constraints, and other client behavior not represented structurally in OpenAPI. | `CONVENTIONS.md`, resource Behavior and Errors sections, `workflows/checkout.md`, `webhooks/payment-completed.md`, and multipart details in `resources/documents.md`. |
| `source/recursive-direct-openapi.yaml` | Authoritative source for direct recursive-schema fallback. | `focused/valid/recursive-direct-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |
| `source/recursive-indirect-openapi.yaml` | Authoritative source for indirect recursive-schema fallback. | `focused/valid/recursive-indirect-unsupported.md` and `focused/invalid/recursive-truncated-representation.md`. |

## Complete-Set Fact Matrix

| Client-visible fact class | Authoritative input | Projected files |
|---|---|---|
| Operations, paths, parameters, request media types, request schemas, defaults, and constraints | `source/complete-openapi.yaml` | `valid/full/resources/`, `valid/compact/resources/` |
| Success status codes, body presence, response media types, response schemas, fixed state values, and generated examples | `source/complete-openapi.yaml` operation responses and response components | Full and compact resource Response sections |
| Caller-visible success response headers | `source/complete-openapi.yaml` response headers | POST `/users` `Location` response-header table |
| Common, validation, and inline error body schemas | `source/complete-openapi.yaml` `components.schemas` and `components.responses`; error conditions and actions from `source/complete-behavior.yaml` | Full and compact `CONVENTIONS.md` error shapes and resource Errors sections |
| Environments, versioning, authentication, request formats, data representation, and common errors | `source/complete-behavior.yaml` | Full and compact `CONVENTIONS.md`; INDEX convention routing |
| `Idempotency-Key`, replay identity, retention, conflicting reuse, and no-key behavior | `source/complete-behavior.yaml` `http_semantics.idempotency` | Full and compact `CONVENTIONS.md`; affected resource Behavior and Errors sections; checkout workflow |
| Endpoint side effects, preconditions, authorization, and endpoint errors | `source/complete-behavior.yaml` `operations` | Full and compact resource files |
| Multipart filename, content-type, boundary, and size constraints | `source/complete-behavior.yaml` `file_transfer` and OpenAPI multipart schema | Full and compact `resources/documents.md` |
| Checkout values, independent payment/order states, early-settlement order eligibility, capture behavior, ambiguous outcomes, and recovery | `source/complete-behavior.yaml` `operations.POST /orders` and `workflow.checkout` | Full and compact `resources/checkout.md` and `workflows/checkout.md`; related resource links |
| Webhook receiver, retry, deduplication, ordering, and event-specific delivery | `source/complete-behavior.yaml` `webhook_delivery` | Full and compact `CONVENTIONS.md` and `webhooks/payment-completed.md` |
| Webhook request header, payload schema, fixed event value, opaque metadata boundary, and processor trace field | `source/complete-openapi.yaml` `webhooks.payment.completed`; header wire rules from `source/complete-behavior.yaml` | Full and compact `webhooks/payment-completed.md` |
| Direct and indirect recursive-schema fallback | Recursive OpenAPI source fixtures | Focused recursive valid and invalid fixtures |

## Structured Contract Inventory

| Operation | Success response source | Projected success contract |
|---|---|---|
| POST `/users` | `201 application/json`, `User`, and required `Location` header | Always-present non-null user body and `Location` |
| GET `/users/{id}` | `200 application/json` and `User` | Always-present non-null user body |
| POST `/carts/{id}/validate` | `200 application/json` and `CartValidationResponse` | `cart_id` and fixed `status=validated` |
| POST `/payments` | `201 application/json` and `PaymentResponse` | `payment_id` and fixed `status=pending` |
| POST `/orders` | `201 application/json` and `OrderResponse` | `order_id` and fixed `status=confirmed` |
| POST `/documents` | `201 application/json` and `DocumentUploadResponse` | `document_id` and fixed `status=uploaded` |

| Error shape | Structural source | Behavioral source |
|---|---|---|
| `standard-error` | `components.schemas.StandardError` and common response components | Common statuses, codes, conditions, caller actions, and message usage in `complete-behavior.yaml` |
| `validation-error` | `components.schemas.ValidationError` and `components.responses.ValidationError` | Status, code, unchanged-input policy, field-message usage, and caller action in `complete-behavior.yaml` |
| `email-taken` | `components.schemas.EmailTakenError` and POST `/users` 409 response | Condition and corrected-input/new-key caller action in `complete-behavior.yaml` |

## Checker Boundary

`tools/check-conformance-fixtures.mjs` checks the corpus-specific DocAI HTTP
expectations: metadata version, stable conformance expectation labels, full/compact
profile pairing, required standard paths, focused valid/invalid snippets, coverage
references, input-set manifest references, source revision consistency, required
source fixture presence, and the operation/schema blocks listed in the structured
contract inventory.

It does not prove that every field in the DocAI HTTP projection was mechanically
generated from the OpenAPI source. That deeper source-to-projection check remains
future work unless the project deliberately defines a reusable validator boundary.

## Source Completeness Result

The `rc.2` review found that the input-set manifest existed but its OpenAPI still
omitted four success bodies, `Location`, error body schemas, and several projected
constraints/defaults. The `rc.3` source revision adds those structural contracts to
`complete-openapi.yaml`, adds the remaining error-field and webhook-header usage rules
to `complete-behavior.yaml`, and restamps the projection as one logical generation.

The structured inventory and fact matrix now account for every known client-visible
fact in the corrected full and compact complete set. The targeted checker assertions
verify the required source blocks without turning the source format into a public
validator contract. Before final stable `v1.0.0` publication, add another source input
only if a conformance document depends on a fact not represented by the manifest's
OpenAPI and pass-through behavior files.

## Refresh Rule

If the conformance document content changes beyond metadata, paths, expectation
labels, or documentation-only traceability notes, repeat this audit and decide
whether the live LLM, token-load, or OpenAPI comparison evidence must also be
refreshed.
