> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-09 | generation_id: workflow-candidate-full-20260709-001 | projection_id: workflow-candidate-20260709-001 | source: fixtures/workflow-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-workflow-candidate-001 | x-fixture: workflow-candidate

# API Index

## Endpoints

### resources/checkout.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /carts/{id}/validate | checkout | Validates cart inventory before payment. | workflows/checkout.md |
| POST | /payments | checkout | Creates a pending payment for a validated cart. | workflows/checkout.md |
| POST | /orders | checkout | Confirms an order from a validated cart and pending payment. | workflows/checkout.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validate cart, create payment, and confirm order. | workflows/checkout.md |

## Webhooks

none
