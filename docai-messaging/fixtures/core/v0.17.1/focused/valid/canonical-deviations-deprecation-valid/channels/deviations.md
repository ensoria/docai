> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## SEND bindings.commands.{tenant} (publish-order)

**deprecated**: use publish-order-v2 and migrate producers before retirement
Publishes an order and observes its correlated reply.

### Behavior

**deviation**: alpha inherited authorization rule is replaced by operation credentials
**deviation**: zeta inherited delivery rule is replaced by broker persistence
- side_effects: dispatches the order for processing
- idempotency: reuse the order identifier when resending
- preconditions: unknown
- authorization: unknown
- delivery: at-least-once -- acknowledge after broker persistence
- ordering: preserve order per customer partition
**unknown**: authorization requires the deployment role mapping
**unknown**: preconditions require the producer workflow

### Operation Bindings

**deviation**: the inherited acknowledgement rule is replaced by replica acknowledgement
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | acknowledgements | `all` replicas acknowledge the publish |

### Channel

**deviation**: the inherited environment rule is replaced by tenant routing
#### Parameters

**deviation**: the inherited tenant source is replaced by the authenticated tenant
| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Use the authenticated tenant identifier |

#### Bindings

**deviation**: the inherited topic rule is replaced by the tenant command topic
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `bindings.commands.{tenant}` |

### Message publish-order

#### Headers

**deviation**: the inherited trace header is replaced by the order identifier
| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| order-id | string | yes | no | Stable order identifier |

#### Bindings

**deviation**: the inherited partition key is replaced by the order identifier
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the order identifier |

#### Payload

**deviation**: the inherited envelope payload is suppressed for this signal
none

### Reply

**deviation**: the inherited reply deadline is replaced by a 30 second deadline
- channel: bindings.replies.{tenant}
- correlation: the reply correlation identifier equals the request correlation identifier
- timeout: 30 seconds -- report the result as unresolved without inventing an outcome

#### Channel

**deviation**: the inherited reply environment is replaced by tenant routing
##### Parameters

**deviation**: the inherited reply tenant source is replaced by the authenticated tenant
| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | string | Use the authenticated tenant identifier |

##### Bindings

**deviation**: the inherited reply topic is replaced by the tenant reply topic
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `bindings.replies.{tenant}` |

#### Message publish-order-reply

##### Headers

**deviation**: the inherited reply correlation header is replaced by correlation-id
| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| correlation-id | string | always | no | Matches the request correlation identifier |

##### Bindings

**deviation**: the inherited reply partition key is replaced by the correlation identifier
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | UTF-8 bytes of the correlation identifier |

##### Payload

**deviation**: the inherited reply envelope payload is suppressed for this signal
none

### Failure Handling

**deviation**: the inherited publish retry rule is replaced by explicit escalation
| Failure | Signal | Condition | Action |
|---|---|---|---|
| publish error | inline:publish-error | The broker rejects the publish | Preserve the failed state, report the error, and stop processing |

**message_shape**: publish-error

- Headers: none
- Bindings: none
#### Payload

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
