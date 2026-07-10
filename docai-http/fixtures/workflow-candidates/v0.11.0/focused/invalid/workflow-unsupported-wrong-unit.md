# invalid: workflow unsupported wrong unit

Expected: invalid workflow candidate. A workflow-section replacement `unsupported` marker must name the enclosing workflow section.

```markdown
# External Approval

Coordinates checkout with an external approval system.

## Preconditions

- The cart is ready for approval.

## Steps

**unsupported**: replaces workflow Payload: approval graph contains dynamic branches at fixtures/workflow-candidate-openapi.yaml#/x-workflows/external-approval

## State Transitions

none

## Failure and Recovery

none
```
