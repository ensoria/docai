> docai-messaging: 0.17.1 | profile: compact | perspective: storefront-service | coverage: requires-source | knowledge: requires-input | source_refs: all

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
| alpha task; representation task; submit an order; update storefront order state; zeta task | SEND; RECEIVE | a.events | z.events | a-operation | z-operation | CreateOrder | z-message | Broad operation range | indexes/operations-broad.md |
| middle task | SEND | m.events | m.events | m-operation | m-operation | m-message | m-message | Middle operation range | indexes/operations-middle.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Alpha delivery | Deliver alpha and record the middle event | workflows/alpha-delivery.md |
| Alpha observability | Observe alpha delivery with synthetic traces | workflows/alpha-observability.md |
| State none | Exercise every workflow section's none state | workflows/state-none.md |
| State unknown | Exercise every workflow section's whole-section unknown state | workflows/state-unknown.md |
| State unsupported | Exercise every workflow section's replacement unsupported state | workflows/state-unsupported.md |

> docai-identity: set_id: b32:qbmoau4nwpkctvr6y5lgkioesq | projection_id: b32:fhpgrvvanncax3sheoynr6guva | set_digest: sha256:8058e0538db3d429d63ec7566521c49454cd5f8a7fce8fb7ec49115fcf4a9f47 | projection_digest: sha256:29de68d6a06b440bee4723b0d8f8d4a8274b1b564c7a4cd5674a0500f6cf83d8
