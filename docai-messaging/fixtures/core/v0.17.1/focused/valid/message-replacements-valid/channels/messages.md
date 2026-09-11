> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND requests.multiple (multiple-messages)

Sends one of two requests and receives one of two correlated replies.

### Behavior

- side_effects: dispatches the selected request
- idempotency: reuse the request identifier when resending
- preconditions: the request variant is selected
- authorization: producer credentials permit request publishing
- delivery: at-least-once -- retry ambiguous publishes with the same request identifier
- ordering: preserve order per request identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message alpha-request

Use when the request `kind` header is `alpha`.
**unsupported**: replaces Message alpha-request: encoded alpha envelope at source-a#/messages/alpha-request

### Message zeta-request

Use when the request `kind` header is `zeta`.

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| kind | string | yes | no | Value `zeta` selects this request message |

#### Bindings

none

#### Payload

none

### Reply

- channel: replies.multiple
- correlation: the reply `correlation-id` header equals the request `correlation-id` header
- timeout: 30 seconds -- report the request as unresolved

#### Channel

- Parameters: none
- Bindings: none

#### Message accepted-reply

Use when the reply `status` header is `accepted`.
**unsupported**: replaces reply Message accepted-reply: encoded accepted envelope at source-a#/messages/accepted-reply

#### Message rejected-reply

Use when the reply `status` header is `rejected`.

##### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| status | string | always | no | Value `rejected` selects this reply message |

##### Bindings

none

##### Payload

none

### Failure Handling

none

### Related

none

## SEND requests.single (single-message)

Sends one request and receives one correlated reply.

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

### Message single-request

**unsupported**: replaces Message single-request: encoded request envelope at source-a#/messages/single-request

### Reply

- channel: replies.single
- correlation: the reply `correlation-id` header equals the request `correlation-id` header
- timeout: 30 seconds -- report the request as unresolved

#### Channel

- Parameters: none
- Bindings: none

#### Message single-reply

**unsupported**: replaces reply Message single-reply: encoded reply envelope at source-a#/messages/single-reply

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
