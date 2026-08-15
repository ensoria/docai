> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND roots.object (root-payload)

Sends a root object while omitting its required openness statement.

### Behavior

- side_effects: dispatches the root payload
- idempotency: reuse the payload identifier when resending
- preconditions: the payload is ready to dispatch
- authorization: producer credentials permit payload publishing
- delivery: at-least-once -- retry ambiguous publishes with the same payload identifier
- ordering: preserve order per payload identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message root-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"id":"obj_01HXYZ"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Root object record |
| id | string | yes | no | Stable object identifier |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
