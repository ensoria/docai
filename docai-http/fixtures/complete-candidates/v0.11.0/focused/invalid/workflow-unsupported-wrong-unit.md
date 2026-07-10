# invalid: workflow unsupported wrong unit

Expected: invalid complete candidate. A workflow-section replacement `unsupported` marker must name the enclosing workflow section.

````markdown
# External Approval

Coordinates checkout with an external approval system.

## Preconditions

- The cart is ready for approval.

## Steps

**unsupported**: replaces webhook Payload: approval graph contains dynamic human-assigned branches at fixtures/complete-candidates/v0.11.0/source/complete-openapi.yaml#/x-docai-workflows/external-approval

## State Transitions

none

## Failure and Recovery

none
````
