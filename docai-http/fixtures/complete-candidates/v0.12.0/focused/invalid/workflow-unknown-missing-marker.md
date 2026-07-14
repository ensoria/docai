# invalid: workflow unknown missing marker

Expected: invalid complete candidate. A workflow whole-section `unknown` state must be followed by the required `**unknown**:` marker that names the missing fact and expected input.

````markdown
> docai-http: 0.12.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-10 | generation_id: complete-candidate-full-20260710-001 | projection_id: complete-candidate-20260710-001 | source: fixtures/complete-candidates/v0.12.0/source/complete-openapi.yaml (OpenAPI 3.1.1)

# Settlement

Settles an order after payment capture.

## Preconditions

- The order exists.

## Steps

unknown

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| order.confirmed | payment.completed webhook received | settlement.pending |

## Failure and Recovery

- If settlement fails, contact operations.
````
