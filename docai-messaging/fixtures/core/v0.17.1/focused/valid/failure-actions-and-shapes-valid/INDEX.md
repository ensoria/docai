> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| source-a | pass-through | none | none | none | source.md | none |

## Operations

### channels/failures.md

| Action | Channel | Operation | Message | Task | Summary | Required context | Supplemental context |
|---|---|---|---|---|---|---|---|
| RECEIVE | failures.expanded | expanded-receive | expanded-receive-message | process failure-prone message | Processes a message with operation-specific failure recovery | none | none |
| SEND | failures.expanded-deviation | expanded-with-deviation | expanded-with-deviation-message | publish with overridden recovery | Publishes with deviations and operation-specific failure recovery | none | none |
| SEND | failures.none | none | none-message | publish without operation failures | Publishes with only common failure conventions | none | none |
| SEND | failures.none-deviation | none-with-deviation | none-with-deviation-message | publish with suppressed convention | Publishes after suppressing an inherited failure convention | none | none |
| SEND | failures.unknown | unknown | unknown-message | publish with unknown failures | Publishes while operation-specific failure behavior is unknown | none | none |
| SEND | failures.unknown-deviation | unknown-with-deviation | unknown-with-deviation-message | publish with deviation and unknown failures | Publishes with a known deviation and unknown failure behavior | none | none |
| SEND | failures.unsupported | unsupported | unsupported-message | publish with unsupported failures | Publishes with externally documented failure handling | none | none |
| SEND | failures.unsupported-deviation | unsupported-with-deviation | unsupported-with-deviation-message | publish with deviation and unsupported failures | Publishes with a deviation and externally documented failure handling | none | none |

## Workflows

none

> docai-identity: set_id: b32:r6s2abwqhnffhouzsfivx7uv6u | projection_id: b32:2su6l5snggpayed76bebjwuzuy | set_digest: sha256:8fa5a006d03b4a53ba9991515bfe95f504c1106ecd5b24cded915f590b2bb9bb | projection_digest: sha256:d4a9e5f64d319e0c107ff04814da99a639d407c15f340ed4a69d46f245e4f480
