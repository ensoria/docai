> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001 | x-fixture: stable-conformance
Compact set: ../compact/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Creates a user record; email must be unique. | none | Authentication, Request Formats, HTTP Semantics, Errors, Validation Errors |
| GET | /users/{id} | get user | Gets one user by ID. | none | Authentication, HTTP Semantics, Errors |

### resources/checkout.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /carts/{id}/validate | checkout | Validates cart inventory before payment. | workflows/checkout.md | Authentication, HTTP Semantics, Errors |
| POST | /orders | checkout | Confirms an order from a validated cart and pending payment. | workflows/checkout.md | Authentication, Request Formats, HTTP Semantics, Errors |

### resources/payments.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /payments | checkout; create payment | Creates a pending payment from a card or bank variant and may later trigger settlement delivery. | workflows/checkout.md, webhooks/payment-completed.md | Authentication, Request Formats, HTTP Semantics, Errors |

### resources/documents.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /documents | upload document | Uploads a document file with optional JSON metadata. | none | Authentication, HTTP Semantics, File Transfer, Errors, Validation Errors |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validate cart, create payment, and confirm order. | workflows/checkout.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |
