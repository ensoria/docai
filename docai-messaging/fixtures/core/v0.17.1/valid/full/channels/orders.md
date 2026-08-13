> docai-messaging: 0.17.1 | profile: full | perspective: storefront-service | coverage: complete | knowledge: complete | source_refs: all

## RECEIVE orders.events (receiveOrderCreated)

Update storefront order state from the created event.

### Behavior

- side_effects: Update the storefront order state to created.
- idempotency: Deduplicate redeliveries by header.message-id and preserve the prior durable result.
- preconditions: The storefront is subscribed to orders.events.
- authorization: OAuth2 scope orders:read is required.
- delivery: at-least-once -- Acknowledge after durable processing; negative-acknowledge retryable failures.
- ordering: Preserve publish order for messages with the same payload.orderId.

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message OrderCreated

#### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| message-id | string | always | no | `minLength=1`; Message identifier retained across redelivery. |

#### Bindings

none

#### Payload

**payload_presence**: always

**media_type**: application/json

**payload_nullable**: no

```json
{
  "createdAt": "2026-01-02T03:05:00Z",
  "orderId": "ord_01HXYZ",
  "status": "created"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties are forbidden. |
| createdAt | string | always | no | `format="date-time"`; Order creation time. |
| orderId | string | always | no | `pattern="^ord_[A-Za-z0-9]+$"`; Order identifier. |
| status | string | always | no | `const="created"`; Created state. |

### Reply

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| retryable handler failure | handler returns a retryable error | Durable processing did not commit and another attempt may succeed. | Negative-acknowledge and re-process; after five attempts publish the failed envelope and diagnostic code to orders.dead-letter. |
| non-retryable handler failure | handler returns a non-retryable error | The message cannot succeed without a contract or configuration change. | Reject without re-processing and publish the failed envelope and diagnostic code to orders.dead-letter. |

### Related

none

## SEND orders.commands (sendCreateOrder)

Submit one order command and await its acceptance reply.

### Behavior

- side_effects: Ask the order service to create the submitted order.
- idempotency: Resend with the same header.message-id; consumers deduplicate for 24 hours.
- preconditions: The referenced tenant and every SKU already exist.
- authorization: OAuth2 scope orders:write is required.
- delivery: at-least-once -- Broker acknowledgement makes publish durable; timeout leaves outcome ambiguous.
- ordering: Publish commands sharing payload.orderId in order.

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message CreateOrder

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| correlation-id | string | yes | no | `minLength=1`; Correlates the acceptance reply. |
| message-id | string | yes | no | `minLength=1`; Message identifier used for deduplication. |
| reply-to | string | yes | no | `const="orders.replies"`; Reply address. |

#### Bindings

none

#### Payload

**payload_required**: yes

**media_type**: application/json

**payload_nullable**: no

```json
{
  "items": [
    {
      "quantity": 2,
      "sku": "sku_demo_01"
    }
  ],
  "orderId": "ord_01HXYZ",
  "tenantId": "tenant_demo"
}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | object | yes | no | Additional properties are forbidden. |
| items | object[] | yes | no | `minItems=1`; Submitted order items. |
| items[] | object | yes | no | Additional properties are forbidden. |
| items[].quantity | int | yes | no | `minimum=1`; Item quantity. |
| items[].sku | string | yes | no | `minLength=1`; SKU identifier. |
| orderId | string | yes | no | `pattern="^ord_[A-Za-z0-9]+$"`; Order identifier. |
| tenantId | string | yes | no | `pattern="^tenant_[A-Za-z0-9]+$"`; Storefront tenant identifier. |

### Reply

- channel: orders.replies
- correlation: The reply correlation-id equals the command correlation-id.
- timeout: 5 seconds -- No acceptance reply arrived before the deadline; command outcome is unknown to the caller.

#### Channel

- Parameters: none
- Bindings: none

#### Message OrderAccepted

##### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| correlation-id | string | always | no | `minLength=1`; Equals the command correlation-id. |
| message-id | string | always | no | `minLength=1`; Reply message identifier. |

##### Bindings

none

##### Payload

**payload_presence**: always

**media_type**: application/json

**payload_nullable**: no

```json
{
  "acceptedAt": "2026-01-02T03:04:05Z",
  "orderId": "ord_01HXYZ",
  "status": "accepted"
}
```

| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| $ | object | always | no | Additional properties are forbidden. |
| acceptedAt | string | always | no | `format="date-time"`; Command acceptance time. |
| orderId | string | always | no | `pattern="^ord_[A-Za-z0-9]+$"`; Order identifier. |
| status | string | always | no | `const="accepted"`; Accepted state. |

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| publish rejected | broker publish error | Authorization or channel configuration rejects the publish. | Do not retry with the same configuration; correct authorization or channel configuration before resending. |
| reply timeout | no correlated reply within 5 seconds | The command publish may have succeeded but no acceptance reply arrived. | Resend with the same message-id when retrying so consumers deduplicate; escalate after five attempts. |

### Related

none

> docai-identity: set_id: b32:qe5xz6fyhcs6horpuskeaw57ay | projection_id: b32:2su6l5snggpayed76bebjwuzuy
