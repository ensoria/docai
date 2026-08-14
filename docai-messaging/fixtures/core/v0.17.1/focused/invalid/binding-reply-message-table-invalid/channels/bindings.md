> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND bindings.commands (publish-order)

Publishes an order with malformed reply-message binding columns.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message publish-order

- Headers: none
- Bindings: none
#### Payload

none

### Reply

- channel: bindings.replies
- correlation: the reply correlation identifier equals the request correlation identifier
- timeout: 30 seconds -- report the result as unresolved without inventing an outcome

#### Channel

- Parameters: none
- Bindings: none

#### Message publish-order-reply

- Headers: none
##### Bindings

| Protocol | Name | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the correlation identifier |

##### Payload

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
