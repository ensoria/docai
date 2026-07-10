# valid: workflow whole-section unknown state

Expected: valid complete candidate. Workflow sections may use the whole-section `unknown` form when applicability or content is not established, and the file knowledge state reflects the missing input.

````markdown
> docai-http: 0.11.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# Settlement

Settles an order after payment capture.

## Preconditions

- The order exists.

## Steps

unknown

**unknown**: settlement step order and required values are not documented; requires settlement runbook

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| order.confirmed | payment.completed webhook received | settlement.pending |

## Failure and Recovery

unknown

**unknown**: recovery actions for failed settlement are not documented; requires operations runbook
````
