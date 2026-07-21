# invalid: workflow unknown missing marker

Expected: invalid complete conformance. A workflow whole-section `unknown` state must be followed by the required `**unknown**:` marker that names the missing fact and expected input.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc2-001 | projection_id: conformance-20260721-rc2-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set)

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
