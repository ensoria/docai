> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND bindings.commands (publish-order)

Publishes an order and observes its correlated reply.

### Behavior

- side_effects: dispatches the order for processing
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to publish
- authorization: producer credentials permit order publishing
- delivery: at-least-once -- acknowledge after broker persistence
- ordering: preserve order per customer partition

### Operation Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | acknowledgements | `all` replicas acknowledge the publish |

### Channel

- Parameters: none
#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `bindings.commands` |

### Message publish-order

- Headers: none
#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the order identifier |

#### Payload

none

### Reply

- channel: bindings.replies
- correlation: the reply correlation identifier equals the request correlation identifier
- timeout: 30 seconds -- report the result as unresolved without inventing an outcome

#### Channel

- Parameters: none
##### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `bindings.replies` |

#### Message publish-order-reply

##### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| correlation-id | string | always | no | Matches the request correlation identifier |

##### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the correlation identifier |

##### Payload

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| publish error | inline:publish-error | The broker rejects the publish | Preserve the failed state, report the error, and stop processing |

**message_shape**: publish-error

- Headers: none
#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the failed order identifier |

#### Payload

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
