# invalid: endpoint Related missing webhook reference

Expected: invalid complete conformance. An endpoint whose INDEX row says to also read a webhook must reference that webhook from its `Related` section.

````markdown
# API Index

## Endpoints

### resources/payments.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /payments | create payment | Creates a pending payment. | webhooks/payment-completed.md |

## Workflows

none

## Webhooks

| Name | Summary | Details |
|---|---|---|
| payment.completed | Sent when a payment settles. | webhooks/payment-completed.md |

---

## POST /payments

Creates a pending payment.

### Related

none
````
