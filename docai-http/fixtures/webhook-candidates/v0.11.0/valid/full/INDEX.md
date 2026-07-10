> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: complete | generated: 2026-07-10 | generation_id: webhook-candidate-full-20260710-001 | projection_id: webhook-candidate-20260710-001 | source: fixtures/webhook-candidate-openapi.yaml (OpenAPI 3.1.1) | source_revision: fixture-revision-webhook-candidate-001 | x-fixture: webhook-candidate

# API Index

## Endpoints

### resources/payments.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /payments | create payment | Creates a pending payment and may later trigger settlement delivery. | webhooks/payment-completed.md |
| PATCH | /subscriptions/{id} | update subscription | Updates or cancels a subscription and may trigger subscription delivery. | webhooks/subscription-events.md |

## Workflows

none

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |
| subscription.events | Sent when a subscription is updated or cancelled. | webhooks/subscription-events.md |
