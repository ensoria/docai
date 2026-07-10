# valid: workflow deviation placement

Expected: valid workflow candidate. Workflow-level deviations appear after the intro description, and section-level deviations appear directly under the affected section heading.

```markdown
# Manual Review

Routes a high-risk checkout through manual review before order confirmation.

**deviation**: the workflow uses a manual review queue instead of automatic order confirmation for high-risk carts.

## Preconditions

- The cart exists and contains at least one item.

## Steps

**deviation**: manual review must finish before the order step can run.

1. POST /reviews - Pass `cart_id`. Keep the returned `review_id`. If review creation fails, update the cart risk data before retrying this step.
2. POST /orders - Pass `cart_id` and `review_id`. Keep the returned `order_id`. If order confirmation fails with a retryable error, keep both values and retry this step.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.flagged | POST /reviews succeeds | review.pending |
| review.pending | POST /orders succeeds | order.confirmed |

## Failure and Recovery

- If review creation fails, update the cart risk data and restart from step 1.
- If order confirmation fails with a retryable error, keep the review and retry step 2.
```
