> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/payload-unknown.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | orders.a.partial-fields | partial-fields | partial-fields-message | send partial fields | Retains named payload fields and omits an unfaithful example | none | none |
| SEND | orders.b.{tenant}.partial-members | partial-members | partial-members-message | send partial members | Retains named channel parameters and message headers | none | none |
| SEND | orders.c.unknown-fields | unknown-fields | unknown-fields-message | send unknown fields | Preserves known representation identity without field names | none | none |
| SEND | orders.d.unknown-representations | unknown-representations | unknown-representations-message | send unknown representations | Preserves whole-payload state without inventing wire identity | none | none |
| SEND | orders.e.{tenant}.unknown-parameters | unknown-parameters | unknown-parameters-message | send with unknown parameters | Preserves a whole unknown channel parameter collection | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
