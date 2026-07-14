# invalid: workflow deviation wrong placement

Expected: invalid complete candidate. Section-level workflow deviations must appear directly under the affected section heading.

````markdown
# Manual Review

Routes a high-risk checkout through manual review.

## Preconditions

- The cart exists.

## Steps

1. POST /reviews - Pass `cart_id`. Keep the returned `review_id`. If review creation fails, update the cart before retrying this step.

**deviation**: manual review may be skipped by staff.

## State Transitions

| From | Endpoint / Event | To |
|---|---|---|
| cart.flagged | POST /reviews succeeds | review.pending |

## Failure and Recovery

- If review creation fails, update the cart and restart from step 1.
````
