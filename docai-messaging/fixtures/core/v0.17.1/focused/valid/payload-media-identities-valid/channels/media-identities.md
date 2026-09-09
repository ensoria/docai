> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND media.identities (emit-media-identities)

Publishes representations whose media identities have already been resolved by exact-version wire adapters.

### Behavior

- side_effects: publishes one selected representation
- idempotency: reuse the message identifier when resending
- preconditions: one supported representation is selected
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message identity-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
The sender selects a representation under the mapped wire contract, and the receiver branches on the wire media type.
**media_type**: application/json;charset=UTF-8
**payload_nullable**: no
```json
{"id":"ord_01"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Order identifier |
**unsupported**: replaces payload representation identity-message 16:application/json: normalized representation schema is unsupported at source.json#/normalized
**unsupported**: replaces payload representation identity-message 30:application/json;title="雪é": multibyte representation schema is unsupported at source.json#/multibyte
**unsupported**: replaces payload representation identity-message 35:application/json;title="雪: UTF-8": delimited representation schema is unsupported at source.json#/delimited

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
