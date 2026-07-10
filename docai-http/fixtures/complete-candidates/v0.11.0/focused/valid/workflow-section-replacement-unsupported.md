# valid: workflow section replacement unsupported

Expected: valid complete candidate. A whole workflow section may be replaced with `unsupported` when the workflow graph cannot be represented faithfully.

````markdown
# External Approval

Coordinates checkout with an external approval system.

## Preconditions

- The cart is ready for approval.

## Steps

**unsupported**: replaces workflow Steps: approval graph contains dynamic human-assigned branches at fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml#/x-docai-workflows/external-approval

## State Transitions

none

## Failure and Recovery

none
````
