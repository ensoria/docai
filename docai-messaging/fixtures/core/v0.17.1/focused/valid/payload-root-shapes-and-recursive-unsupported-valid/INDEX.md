> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/root-shapes.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | roots.a.recursive | recursive-payload | recursive-payload-message | send recursive payload | Preserves a recursive schema without finite truncation | none | none |
| SEND | roots.b.array | root-array | root-array-message | send root array | Constructs a root array and its item records | none | none |
| SEND | roots.c.map | root-map | root-map-message | send root map | Constructs a dynamic-key root map | none | none |
| SEND | roots.d.object | root-object | root-object-message | send root object | Constructs a constrained open root object | none | none |
| SEND | roots.e.scalar | root-scalar | root-scalar-message | send root scalar | Constructs a scalar root value | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
