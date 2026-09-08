> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-contract | pass-through | none | none | none | contract.json | none |
| source-routing | configuration | none | none | none | routing.json | none |
| source-unrelated | pass-through | none | none | none | unrelated.json | none |

## Operations

### channels/inventory.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| RECEIVE | inventory.events | inventory-changed | inventory-changed | update inventory | Applies an inventory state change | none | none |

### channels/orders.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | orders.commands | create-order | create-order | create order | Publishes an order creation command | none | none |

## Workflows

none

> docai-identity: set_id: b32:o6l23auvtygpd3villd332mtc4 | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:7797ad82959e0cf1eea85ac7bde99317cfcb30cb4fed63a0bca496c400833f52 | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
