> docai-messaging: 0.17.1 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| storefront-asyncapi-3.1.0 | asyncapi | AsyncAPI 3.1.0 | urn:example:storefront-order-messaging | 1.0.0 | storefront.asyncapi.json | 1.0.0 |
| storefront-behavior | behavior-configuration | none | none | none | storefront-behavior.json | fixture-1 |

## Operations

### channels/orders.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| RECEIVE | orders.events | receiveOrderCreated | OrderCreated | update storefront order state | Update storefront state after an order is created. | none | none |
| SEND | orders.commands | sendCreateOrder | CreateOrder; reply:OrderAccepted | submit an order | Submit an order and receive its acceptance reply. | none | none |

## Workflows

none

> docai-identity: set_id: b32:qe5xz6fyhcs6horpuskeaw57ay | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:813b7cf8b838a5e3ba2fa494405bbf061bd1c6c0f693077d7349fd4c4d45dd2b | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
