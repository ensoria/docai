> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

## SEND orders.{tenant} (mixed-markers)

Publishes one message while preserving independently incomplete table facts.

### Behavior

- side_effects: dispatches the message for processing
- idempotency: reuse the message identifier when resending
- preconditions: the message is ready to publish
- authorization: producer credentials permit publishing
- delivery: at-least-once -- retry ambiguous publishes with the same message identifier
- ordering: preserve order per tenant and message identifier

### Operation Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | acknowledgements | unknown |
**unknown**: Broker acknowledgement mode requires the deployment configuration
**unknown**: Value / Rule for acknowledgements requires the broker contract
**unsupported**: localized: alpha operation binding omitted at source-a#/operation-bindings/alpha
**unsupported**: localized: zeta operation binding omitted at source-a#/operation-bindings/zeta
**x-alpha**: operation binding extension alpha
**x-zeta**: operation binding extension zeta

### Channel

#### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | unknown | Tenant routing value |
**unknown**: additional unnamed parameter requires the complete channel declaration at source-a
**unknown**: Type for tenant requires the channel parameter schema
**unsupported**: localized: alpha channel parameter feature omitted at source-a#/parameters/alpha
**unsupported**: localized: zeta channel parameter feature omitted at source-a#/parameters/zeta
**x-alpha**: channel parameter extension alpha
**x-zeta**: channel parameter extension zeta

#### Bindings

none

### Message mixed-marker-message

#### Headers

| Name | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| trace-id | unknown | yes | no | Trace identifier |
**unknown**: additional unnamed header requires the complete message header declaration at source-a
**unknown**: Type for trace-id requires the message schema
**unsupported**: localized: alpha message header feature omitted at source-a#/headers/alpha
**unsupported**: localized: zeta message header feature omitted at source-a#/headers/zeta
**x-alpha**: message header extension alpha
**x-zeta**: message header extension zeta

#### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | key | unknown |
**unknown**: Value / Rule for key requires the envelope contract
**unsupported**: localized: alpha message binding omitted at source-a#/message-bindings/alpha
**unsupported**: localized: zeta message binding omitted at source-a#/message-bindings/zeta
**x-alpha**: message binding extension alpha
**x-zeta**: message binding extension zeta

#### Payload

**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| id | unknown | yes | no | Stable message identifier |
**unknown**: additional unnamed field requires the complete payload schema at source-a
**unknown**: Type for id requires the payload schema
**unsupported**: localized: alpha payload field feature omitted at source-a#/payload/alpha
**unsupported**: localized: zeta payload field feature omitted at source-a#/payload/zeta
**x-alpha**: payload field extension alpha
**x-zeta**: payload field extension zeta

### Reply

- channel: orders.{tenant}.replies
- correlation: the reply trace identifier equals the request trace identifier
- timeout: 30 seconds -- report the result as unresolved without inventing an outcome

#### Channel

##### Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| tenant | unknown | Tenant routing value copied from the request context |
**unknown**: additional unnamed parameter requires the complete reply channel declaration at source-a
**unknown**: Type for tenant requires the reply channel parameter schema
**unsupported**: localized: alpha reply channel parameter feature omitted at source-a#/reply/parameters/alpha
**unsupported**: localized: zeta reply channel parameter feature omitted at source-a#/reply/parameters/zeta
**x-alpha**: reply channel parameter extension alpha
**x-zeta**: reply channel parameter extension zeta

##### Bindings

| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | unknown |
**unknown**: Value / Rule for topic requires the reply channel contract
**unsupported**: localized: alpha reply channel binding omitted at source-a#/reply/bindings/alpha
**unsupported**: localized: zeta reply channel binding omitted at source-a#/reply/bindings/zeta
**x-alpha**: reply channel binding extension alpha
**x-zeta**: reply channel binding extension zeta

#### Message mixed-marker-reply

- Headers: none
- Bindings: none
##### Payload

none

### Failure Handling

| Failure | Signal | Condition | Action |
|---|---|---|---|
| broker-unavailable | broker error | unknown | Preserve the unresolved state, report the error, and retry after the broker recovers |
**unknown**: Condition for broker-unavailable requires the broker failure contract
**unsupported**: localized:  failure feature omitted at source-a#/failures/private-use
**unsupported**: localized: 😀 failure feature omitted at source-a#/failures/emoji
**x-alpha**: failure extension alpha
**x-zeta**: failure extension zeta

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
