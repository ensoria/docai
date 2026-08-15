> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND roots.recursive (recursive-payload)

Sends a recursive payload whose replacement improperly coexists with normal content.

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

### Message recursive-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**unsupported**: replaces payload representation recursive-message 16:application/json: recursive schema at source.json#/recursivePayload
A finite prefix is also described here.

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy
