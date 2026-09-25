> docai-messaging: 0.17.1 | profile: full | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

Compact set: ../compact/

# Messaging Index

## Sources

### Source Shards

| First ID | Last ID | Kinds | Summary | Details |
|---|---|---|---|---|
| complete-contexts | storefront-behavior | behavior-configuration | Complete contexts and behavior sources | indexes/sources-contexts-behavior.md |
| storefront-asyncapi-3.1.0 | storefront-asyncapi-3.1.0 | asyncapi | AsyncAPI contract source | indexes/sources-asyncapi.md |

## Operation Shards

| Tasks | Actions | First channel | Last channel | First operation | Last operation | First message | Last message | Summary | Details |
|---|---|---|---|---|---|---|---|---|---|
| alpha task; representation task; zeta task | SEND; RECEIVE | a.events | z.events | a-operation | z-operation | a-message | z-message | Broad operation range | indexes/operations-broad.md |
| middle task | SEND | m.events | m.events | m-operation | m-operation | m-message | m-message | Middle operation range | indexes/operations-middle.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Alpha delivery | Deliver alpha and record the middle event | workflows/alpha-delivery.md |
| Alpha observability | Observe alpha delivery with synthetic traces | workflows/alpha-observability.md |
| State none | Exercise every workflow section's none state | workflows/state-none.md |
| State unknown | Exercise every workflow section's whole-section unknown state | workflows/state-unknown.md |
| State unsupported | Exercise every workflow section's replacement unsupported state | workflows/state-unsupported.md |

> docai-identity: set_id: b32:cueqq3gfwvgyvamqcvx5g326va | projection_id: b32:bnzbddlon6mxaiywtzumct7w6y | set_digest: sha256:1509086cc5b54d8a8190156fd36f5ea89f13f7b846a05391847830ac8e1c8258 | projection_digest: sha256:0b72118d6e6f997023169e68c14ff6f661f83fa408ad7023e009481ae5a25c47
