> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

## SEND deviations.incomplete.{tenant} (publish-with-incomplete-deviations)

Publishes a command while preserving independently known local deviations.

### Behavior

**deviation**: alpha inherited authorization rule is replaced by operation credentials
**deviation**: zeta inherited delivery rule is replaced by broker persistence
- side_effects: dispatches the command for processing
- idempotency: reuse the command identifier when resending
- preconditions: the command is ready to dispatch
- authorization: unknown
- delivery: at-least-once -- acknowledge after broker persistence
- ordering: preserve order per tenant partition
**unknown**: authorization requires the deployment role mapping

### Operation Bindings

**deviation**: the inherited acknowledgement rule is replaced by deployment-specific acknowledgement
unknown
**unknown**: operation binding rules require the deployment broker configuration at source-a

### Channel

**deviation**: the inherited environment rule is replaced by tenant routing
#### Parameters

**deviation**: the inherited tenant source is replaced by authenticated tenant context
**unsupported**: replaces channel Parameters: encoded tenant routing rules at source-a#/channel/parameters

#### Bindings

**deviation**: the inherited topic rule is replaced by deployment routing
| Protocol | Property | Value / Rule |
|---|---|---|
| kafka | topic | `deviations.incomplete.{tenant}` |

### Message incomplete-command

#### Headers

**deviation**: the inherited command envelope is replaced by deployment headers
unknown
**unknown**: message header collection requires the complete envelope declaration at source-a

#### Bindings

**deviation**: the inherited partition rule is replaced by deployment partitioning
**unsupported**: replaces message Bindings incomplete-command: encoded partition binding at source-a#/messages/incomplete-command/bindings

#### Payload

**deviation**: the inherited command example is replaced by a synthetic identifier
**payload_required**: yes
**media_type**: application/json
**payload_nullable**: no
```json
"cmd_01HXYZ"
```
| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| $ | string | yes | no | Stable synthetic command identifier |
**unknown**: valid example values require authoritative business examples at source-a

### Reply

**deviation**: the inherited reply deadline is replaced by a 30 second deadline
- channel: deviations.replies.{tenant}
- correlation: the reply correlation identifier equals the command identifier
- timeout: 30 seconds -- report the result as unresolved without inventing an outcome

#### Channel

**deviation**: the inherited reply environment is replaced by tenant routing
##### Parameters

**deviation**: the inherited reply tenant source is replaced by authenticated tenant context
unknown
**unknown**: reply channel parameter rules require the complete reply channel declaration at source-a

##### Bindings

**deviation**: the inherited reply topic rule is replaced by deployment routing
**unsupported**: replaces reply channel Bindings: encoded reply binding at source-a#/reply/channel/bindings

#### Message incomplete-reply

##### Headers

**deviation**: the inherited reply envelope is replaced by deployment headers
unknown
**unknown**: reply message header collection requires the complete envelope declaration at source-a

##### Bindings

**deviation**: the inherited reply partition rule is replaced by deployment partitioning
**unsupported**: replaces reply message Bindings incomplete-reply: encoded reply partition binding at source-a#/reply/messages/incomplete-reply/bindings

##### Payload

**deviation**: the inherited reply payload rule is retained beside unresolved wire identity
**payload_presence**: optional
unknown
**unknown**: payload representation set requires the complete reply wire identity at source-a

### Failure Handling

**deviation**: the inherited retry rule is replaced by explicit escalation
**unsupported**: replaces Failure Handling: encoded recovery rules at source-a#/failures

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
