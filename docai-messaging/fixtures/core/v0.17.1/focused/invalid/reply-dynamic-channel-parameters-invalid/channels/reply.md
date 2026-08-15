> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND requests.dynamic (request)

Sends a request and receives a correlated reply.

### Behavior

- side_effects: dispatches the request
- idempotency: reuse the request identifier when resending
- preconditions: the request is ready to dispatch
- authorization: producer credentials permit request publishing
- delivery: at-least-once -- retry ambiguous publishes with the same request identifier
- ordering: preserve order per request identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message request-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

- channel: dynamic -- taken from the request's `reply-to` header as the exact channel address
- correlation: the reply `correlation-id` header equals the request `correlation-id` header
- timeout: 30 seconds -- report the request as unresolved

#### Channel

##### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Tenant identifier that must not be declared for a dynamic channel |

##### Bindings

none

#### Message request-reply

- Headers: none
- Bindings: none
##### Payload

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
