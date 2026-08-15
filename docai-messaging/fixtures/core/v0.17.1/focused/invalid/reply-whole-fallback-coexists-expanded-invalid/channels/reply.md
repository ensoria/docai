> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND requests.unknown (request)

Sends a request while reply selection remains unresolved.

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

unknown
**unknown**: reply message set requires the authoritative reply selection at source-a
- channel: replies.unknown

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
