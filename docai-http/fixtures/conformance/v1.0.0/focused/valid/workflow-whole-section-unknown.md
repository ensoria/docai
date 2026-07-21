# valid: workflow whole-section unknown state

Expected: valid complete conformance. Workflow sections may use the whole-section `unknown` form when applicability or content is not established, and the file knowledge state reflects the missing input.

````markdown
> docai-http: 1.0.0 | profile: full | coverage: complete | knowledge: requires-input | generated: 2026-07-21 | generation_id: conformance-full-20260721-rc4-001 | projection_id: conformance-20260721-rc4-001 | source: fixtures/conformance/v1.0.0/source/complete-input-set.yaml (authoritative input set) | source_revision: fixture-input-set-rc3-001

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
