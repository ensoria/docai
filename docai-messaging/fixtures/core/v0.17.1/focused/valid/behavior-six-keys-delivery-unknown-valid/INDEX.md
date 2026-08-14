> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: complete | knowledge: requires-input | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/behavior.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| SEND | behavior.commands | at-least-once | at-least-once | send at least once | Retries ambiguous publishes with a stable deduplication key | none | none |
| SEND | behavior.commands | at-most-once | at-most-once | send at most once | Attempts the publish once without retrying an ambiguous outcome | none | none |
| SEND | behavior.commands | exactly-once | exactly-once | send exactly once | Commits the publish within one qualified transaction boundary | none | none |
| SEND | behavior.commands | unknown-facts | unknown-facts | send with unknown behavior | Requires authoritative handler and broker behavior inputs | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
