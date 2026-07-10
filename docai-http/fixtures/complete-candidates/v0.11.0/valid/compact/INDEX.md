> docai-http: 0.11.0 | profile: compact | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: complete-candidate-compact-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-complete-candidate-001 | x-fixture: complete-candidate
Full set: ../full/

# API Index

## Endpoints

### resources/users.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /users | create user | Creates a user record; email must be unique. | none | Authentication, Request Formats, Errors, Validation Errors |
| GET | /users/{id} | get user | Gets one user by ID. | none | Authentication, HTTP Semantics, Errors |

### resources/checkout.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /carts/{id}/validate | checkout | Validates cart inventory before payment. | workflows/checkout.md | Authentication, HTTP Semantics, Errors |
| POST | /orders | checkout | Confirms an order from a validated cart and pending payment. | workflows/checkout.md | Authentication, Request Formats, Errors |

### resources/payments.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /payments | checkout; create payment | Creates a pending payment from a card or bank variant and may later trigger settlement delivery. | workflows/checkout.md, webhooks/payment-completed.md | Authentication, Request Formats, Errors |

### resources/documents.md

| Method | Path | Task | Summary | Also read | Conventions |
|---|---|---|---|---|---|
| POST | /documents | upload document | Uploads a document file with optional JSON metadata. | none | Authentication, File Transfer, Errors, Validation Errors |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validate cart, create payment, and confirm order. | workflows/checkout.md |

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |
