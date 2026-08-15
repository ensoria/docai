> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

## RECEIVE orders.events (receive-order)

Observes an order event and preserves direction-correct presence semantics.

### Behavior

- side_effects: records the received order event
- idempotency: deduplicate by event identifier
- preconditions: the event consumer is running
- authorization: consumer credentials permit event reads
- delivery: at-least-once -- acknowledge after durable processing
- ordering: preserve order per order identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message order-received

#### Headers

| Name | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| x-event-id | string | always | no | Stable event identifier |
| x-note | string | optional | yes | Optional operator note |
| x-tenant | string | when the channel is shared by multiple tenants | no | Identifies the tenant on shared channels |
| x-trace | unknown | unknown | unknown | Trace contract requires the event envelope source |
**unknown**: Type, Presence, and Nullable for x-trace require the authoritative event envelope at source-a

#### Bindings

none

#### Payload

**payload_presence**: optional
**media_type**: application/json
**payload_nullable**: yes
```json
{"account":{"id":"acct_01HXYZ"},"audit":null,"items":[{"sku":"sku_01HXYZ"}],"kind":"summary","note":null}
```
| Field | Type | Presence | Nullable | Meaning |
|---|---|---|---|---|
| account | object | optional | yes | Additional properties are forbidden |
| account.id | string | always | no | Account identifier when account is present and non-null |
| audit | object | optional | yes | Additional properties are forbidden |
| audit.actor | string | always | no | Actor identifier when audit is present and non-null |
| detail | string | when kind equals "detailed" | no | Detailed event description |
| items | object[] | when the event contains line items | no | Ordered line items |
| items[] | object | always | no | Additional properties are forbidden |
| items[].sku | string | always | no | Item identifier for each present array element |
| kind | string | always | no | Event detail mode |
| note | string | optional | yes | Optional nullable event note |
| source | object | optional | yes | Additional properties are forbidden |
| source.name | string | always | no | Source name when source is present and non-null |
| supplemental | unknown | unknown | unknown | Supplemental field contract requires the event schema |
**unknown**: Type, Presence, and Nullable for supplemental require the authoritative event schema at source-a

### Reply

none

### Failure Handling

none

### Related

none

## SEND orders.commands (send-order)

Constructs an order command and preserves direction-correct required semantics.

### Behavior

- side_effects: dispatches the order command
- idempotency: reuse the order identifier when resending
- preconditions: the order is ready to dispatch
- authorization: producer credentials permit command publishing
- delivery: at-least-once -- retry ambiguous publishes with the same order identifier
- ordering: preserve order per customer identifier

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message order-command

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| x-order-id | string | yes | no | Stable order identifier |
| x-note | string | no | yes | Optional nullable operator note |
| x-tenant | string | conditional | no | Required when the command channel is shared by multiple tenants |
| x-trace | unknown | unknown | unknown | Trace contract requires the command envelope source |
**unknown**: Type, Required, and Nullable for x-trace require the authoritative command envelope at source-a

#### Bindings

none

#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
{"customer":{"id":"cus_01HXYZ"},"items":[{"sku":"sku_01HXYZ"}],"metadata":null,"note":null}
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| customer | object | no | yes | Additional properties are forbidden |
| customer.id | string | yes | no | Customer identifier when customer is present and non-null |
| delivery | object | no | yes | Additional properties are forbidden |
| delivery.address | string | yes | no | Address when delivery is present and non-null |
| items | object[] | conditional | no | Required when the order contains physical items |
| items[] | object | yes | no | Additional properties are forbidden |
| items[].sku | string | yes | no | Item identifier for each present array element |
| metadata | object | no | yes | Additional properties are forbidden |
| metadata.trace | string | yes | no | Trace value when metadata is present and non-null |
| note | string | no | yes | Optional nullable operator note |
| supplemental | unknown | unknown | unknown | Supplemental field contract requires the command schema |
**unknown**: Type, Required, and Nullable for supplemental require the authoritative command schema at source-a

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
