> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

## RECEIVE replies.static.{tenant} (consume-static-reply)

Independently consumes the reply message selected by the static request operation.

### Behavior

- side_effects: records the independently consumed reply
- idempotency: deduplicate by correlation identifier
- preconditions: the reply consumer is active
- authorization: consumer credentials permit reply consumption
- delivery: at-least-once -- acknowledge after the reply is recorded
- ordering: preserve order per correlation identifier

### Operation Bindings

none

### Channel

#### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Tenant identifier established by the consumer configuration |

#### Bindings

none

### Message static-reply

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

none

### Related

SEND requests.static (static-request)

## SEND requests.dynamic (dynamic-request)

Sends a request whose reply channel is carried by the request.

### Behavior

- side_effects: dispatches the dynamic-channel request
- idempotency: reuse the request identifier when resending
- preconditions: a reply channel has been allocated
- authorization: producer credentials permit request publishing
- delivery: at-least-once -- retry ambiguous publishes with the same request identifier
- ordering: preserve order per request identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message dynamic-request-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

- channel: dynamic -- taken from the request's `reply-to` header as the exact channel address
- correlation: the reply `correlation-id` header equals the request `correlation-id` header
- timeout: 15 seconds -- retry once with the same request identifier, then report unresolved

#### Channel

- Parameters: none
- Bindings: none

#### Message dynamic-reply

- Headers: none
- Bindings: none
##### Payload

none

### Failure Handling

none

### Related

none

## SEND requests.none (no-reply)

Sends a one-way request with no correlated counterpart.

### Behavior

- side_effects: dispatches the one-way request
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

### Message no-reply-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

none

### Failure Handling

none

### Related

none

## RECEIVE requests.receive (receive-request)

Receives a request and sends its correlated counterpart.

### Behavior

- side_effects: records the received request before replying
- idempotency: deduplicate by request identifier
- preconditions: the request consumer is active
- authorization: consumer credentials permit request consumption
- delivery: at-least-once -- acknowledge after the request is recorded
- ordering: preserve order per request identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message receive-request-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

- channel: replies.receive
- correlation: the sent reply `correlation-id` header equals the received request `correlation-id` header
- timeout: none

#### Channel

- Parameters: none
- Bindings: none

#### Message receive-reply

- Headers: none
- Bindings: none
##### Payload

none

### Failure Handling

none

### Related

none

## SEND requests.static (static-request)

Sends a request and receives its correlated counterpart on a static channel.

### Behavior

- side_effects: dispatches the static-channel request
- idempotency: reuse the request identifier when resending
- preconditions: the tenant identifier is available
- authorization: producer credentials permit request publishing
- delivery: at-least-once -- retry ambiguous publishes with the same request identifier
- ordering: preserve order per request identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message static-request-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

- channel: replies.static.{tenant}
- correlation: the reply `correlation-id` header equals the request `correlation-id` header
- timeout: 30 seconds -- report the request as unresolved without inventing an outcome

#### Channel

##### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Tenant identifier copied from the authenticated request context |

##### Bindings

none

#### Message static-reply

- Headers: none
- Bindings: none
##### Payload

none

### Failure Handling

none

### Related

RECEIVE replies.static.{tenant} (consume-static-reply)

## SEND requests.unknown (unknown-reply)

Sends a request while retaining an unresolved reply-message selection boundary.

### Behavior

- side_effects: dispatches the selection-unknown request
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

### Message unknown-reply-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

unknown
**unknown**: reply message set requires the authoritative reply selection at source-a

### Failure Handling

none

### Related

none

## SEND requests.unsupported (unsupported-reply)

Sends a request whose known zero-message reply cannot be represented as expanded Reply content.

### Behavior

- side_effects: dispatches the zero-message-reply request
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

### Message unsupported-reply-message

- Headers: none
- Bindings: none
#### Payload

none

### Reply

**unsupported**: replaces Reply: zero-message reply source-a#/requests/unsupported/reply/messages

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
