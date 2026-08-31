> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

## SEND tables.standard (publish-standard)

Publishes a message with a standard-only field table.

### Behavior

- side_effects: dispatches the standard message
- idempotency: reuse the message identifier when resending
- preconditions: the standard message is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry an ambiguous publish with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message standard-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"id":"std_01"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Stable standard message identifier |

### Reply

none

### Failure Handling

none

### Related

none

## SEND tables.with-extensions (publish-with-extensions)

Publishes a message with a contiguous final extension-column suffix.

### Behavior

- side_effects: dispatches the extended message
- idempotency: reuse the message identifier when resending
- preconditions: the extended message is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry an ambiguous publish with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message extended-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"id":"ext_01"}
```
| Field | Type | Required | Nullable | Constraints / Meaning | x-source | x-note |
|---|---|---|---|---|---|---|
| id | string | yes | no | Stable extended message identifier | source-a#/messages/extended | diagnostic-only provenance |

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
