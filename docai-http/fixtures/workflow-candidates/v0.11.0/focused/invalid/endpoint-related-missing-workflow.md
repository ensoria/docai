# invalid: endpoint Related missing workflow reference

Expected: invalid workflow candidate. An endpoint whose INDEX row says to also read a workflow must reference that workflow from its `Related` section.

````markdown
# API Index

## Endpoints

### resources/checkout.md

| Method | Path | Task | Summary | Also read |
|---|---|---|---|---|
| POST | /payments | checkout | Creates a pending payment. | workflows/checkout.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Checkout | Validates payment and creates an order. | workflows/checkout.md |

## Webhooks

none
````

````markdown
## POST /payments

Creates a pending payment.

### Related

none
````
