> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

## SEND schemas.empty (send-empty-schema)

Documents a payload whose effective supported schema permits no valid decoded instance.

### Behavior

- side_effects: none
- idempotency: none
- preconditions: none
- authorization: none
- delivery: none
- ordering: none

### Operation Bindings

none

### Channel

- Parameters: none
- Bindings: none

### Message empty-schema-message

- Headers: none
- Bindings: none
#### Payload

**payload_required**: yes
**unsupported**: replaces payload representation empty-schema-message 16:application/json: effective supported schema permits no valid decoded instance at source.json#/components/schemas/Empty

### Reply

none

### Failure Handling

none

### Related

none

> docai-identity: set_id: b32:m2faklpr3fkjopxy6e2t3jtc5i | projection_id: b32:2su6l5snggpayed76bebjwuzuy
