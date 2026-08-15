> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: complete | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/wire.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | wire.a.json | direct-json | direct-json-message | send JSON | Sends a directly supported JSON representation with mapped logical headers | none | none |
| SEND | wire.b.vendor-json | direct-vendor-json | direct-vendor-json-message | send vendor JSON | Sends a parameterless structured-suffix JSON representation | none | none |
| SEND | wire.c.parameterized | parameterized-json | parameterized-json-message | report unsupported parameterized JSON | Preserves the unavailable exact parameterized wire adapter boundary | none | none |
| SEND | wire.d.xml | unregistered-xml | unregistered-xml-message | report unsupported XML | Preserves the unavailable unregistered XML wire adapter boundary | none | none |
| SEND | wire.e.binary | opaque-binary | opaque-binary-message | send opaque bytes | Sends an authoritatively opaque binary representation | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480

