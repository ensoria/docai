> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND wire.a.json (direct-json)

Sends parameterless JSON with a logical header map.

### Behavior

- side_effects: dispatches the JSON message
- idempotency: reuse the message identifier when resending
- preconditions: the JSON message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message direct-json-message

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| trace-id | string | yes | no | Exposed Kafka record header containing the trace identifier |

#### Bindings

none

#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"id":"ord_01"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Order identifier |

### Reply

none

### Failure Handling

none

### Related

none

## SEND wire.b.vendor-json (direct-vendor-json)

Sends a parameterless media type whose subtype ends in the JSON structured suffix.

### Behavior

- side_effects: dispatches the vendor JSON message
- idempotency: reuse the message identifier when resending
- preconditions: the vendor JSON message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message direct-vendor-json-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: text/vnd.example+json
**payload_nullable**: no
```json
{"id":"ord_02"}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | string | yes | no | Order identifier |

### Reply

none

### Failure Handling

none

### Related

none

## SEND wire.c.parameterized (parameterized-json)

Reports the known parameterized representation whose exact wire adapter is unavailable.

### Behavior

- side_effects: dispatches the parameterized JSON message
- idempotency: reuse the message identifier when resending
- preconditions: the parameterized JSON message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message parameterized-json-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**unsupported**: replaces payload representation parameterized-json-message 30:application/json;charset=utf-8: exact parameterized wire adapter is unavailable

### Reply

none

### Failure Handling

none

### Related

none

## SEND wire.d.xml (unregistered-xml)

Reports the known XML representation whose exact wire adapter is unavailable.

### Behavior

- side_effects: dispatches the XML message
- idempotency: reuse the message identifier when resending
- preconditions: the XML message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message unregistered-xml-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**unsupported**: replaces payload representation unregistered-xml-message 15:application/xml: exact XML wire adapter is unavailable

### Reply

none

### Failure Handling

none

### Related

none

## SEND wire.e.binary (opaque-binary)

Sends bytes that authoritative inputs establish have no structured decoded-value model.

### Behavior

- side_effects: dispatches the opaque byte message
- idempotency: reuse the message identifier when resending
- preconditions: the opaque byte message is ready to dispatch
- authorization: producer credentials permit wire validation publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per message identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message opaque-binary-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**media_type**: application/octet-stream
Opaque image bytes are limited to 2 MiB and carry a SHA-256 integrity digest.

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy

