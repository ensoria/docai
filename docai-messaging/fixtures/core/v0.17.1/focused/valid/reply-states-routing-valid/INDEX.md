> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/replies.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| RECEIVE | replies.static.{tenant} | consume-static-reply | static-reply | consume reply | Independently consumes the same channel message used by an embedded reply | none | none |
| SEND | requests.dynamic | dynamic-request | dynamic-request-message; reply:dynamic-reply | send dynamic request | Receives a correlated response on a request-selected dynamic channel | none | none |
| SEND | requests.none | no-reply | no-reply-message | send one-way request | Sends a request with an authoritatively absent reply contract | none | none |
| RECEIVE | requests.receive | receive-request | receive-request-message; reply:receive-reply | receive request | Sends a correlated response whose deadline follows conventions | none | none |
| SEND | requests.static | static-request | static-request-message; reply:static-reply | send static request | Receives a correlated response on a parameterized static channel | none | none |
| SEND | requests.unknown | unknown-reply | unknown-reply-message | send unknown reply request | Retains the primary operation while reply selection needs input | none | none |
| SEND | requests.unsupported | unsupported-reply | unsupported-reply-message | send unsupported reply request | Retains the primary operation while zero-message reply selection is unprojectable | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
