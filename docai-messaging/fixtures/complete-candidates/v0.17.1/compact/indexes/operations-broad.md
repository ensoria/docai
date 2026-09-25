> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

# Messaging Operation Index

## Operations

### channels/alpha.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context | Conventions |
|---|---|---|---|---|---|---|---|---|
| SEND | a.events | a-operation | a-message | alpha task | Handles the alpha event range | workflows/alpha-delivery.md | workflows/alpha-observability.md, workflows/state-none.md, workflows/state-unknown.md, workflows/state-unsupported.md | none |

### channels/representations.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context | Conventions |
|---|---|---|---|---|---|---|---|---|
| SEND | representations.csv | r-csv-operation | csv-message | representation task | Sends one adapter-defined CSV record | none | none | Data Representation |
| SEND | representations.json-original | r-json-original-operation | json-original-message | representation task | Sends the canonical reusable JSON record | none | none | Data Representation |
| SEND | representations.json-reuse | r-json-reuse-operation | json-reuse-message | representation task | Sends the reused JSON record | none | none | Data Representation |
| SEND | representations.raw | r-raw-operation | raw-message | representation task | Sends an opaque raw receipt | none | none | Data Representation |
| SEND | representations.tagged | r-tagged-operation | tagged-message | representation task | Sends a tagged lifecycle event | none | none | Data Representation |
| RECEIVE | representations.untagged | r-untagged-operation | untagged-message | representation task | Receives an untagged lifecycle event | none | none | Data Representation |

### channels/zeta.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context | Conventions |
|---|---|---|---|---|---|---|---|---|
| RECEIVE | z.events | z-operation | z-message | zeta task | Handles the zeta event range | none | none | none |

> docai-identity: set_id: b32:yvpcjzmj3rarcjj7kqq2ea5sqm | projection_id: b32:cc7dt7ad4wwrbmu6jgpcnxujwe
