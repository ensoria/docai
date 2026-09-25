> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: requires-source | knowledge: requires-input | source_refs: all

Full set: ../full/

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

> docai-identity: set_id: b32:yvpcjzmj3rarcjj7kqq2ea5sqm | projection_id: b32:cc7dt7ad4wwrbmu6jgpcnxujwe | set_digest: sha256:c55e24e589dc4111253f5421a203b2839e2f47cd22779c5554ed4427a0cb0219 | projection_digest: sha256:10be39fc03e5ad10b29e499e26de89b11083e0077317257d0c165434d1d1bd55
