> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

# Messaging Operation Index

## Operations

### channels/alpha.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | a.events | a-operation | a-message | alpha task | Handles the alpha event range | workflows/alpha-delivery.md | workflows/alpha-observability.md, workflows/state-none.md, workflows/state-unknown.md, workflows/state-unsupported.md |

### channels/representations.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | representations.raw | r-raw-operation | raw-message | representation task | Sends an opaque raw receipt | none | none |
| SEND | representations.tagged | r-tagged-operation | tagged-message | representation task | Sends a tagged lifecycle event | none | none |
| RECEIVE | representations.untagged | r-untagged-operation | untagged-message | representation task | Receives an untagged lifecycle event | none | none |

### channels/zeta.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| RECEIVE | z.events | z-operation | z-message | zeta task | Handles the zeta event range | none | none |

> docai-identity: set_id: b32:26yz6sr2e5uoszbbex4vkm663a | projection_id: b32:edqbodvg6sp75kl3lpsrh37bfy
