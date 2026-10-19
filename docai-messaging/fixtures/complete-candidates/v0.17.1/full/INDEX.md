> docai-messaging: 0.17.1 | profile: full | perspective: storefront-service | coverage: requires-source | knowledge: requires-input | source_refs: all

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

> docai-identity: set_id: b32:scpkiqt4ybgigdtklnrj65uzwy | projection_id: b32:bxstnciuebhexjqqvarofkxiui | set_digest: sha256:909ea4427cc04c830e6a5b629f7699b6465a283c446f98d4b155767cb42979ce | projection_digest: sha256:0de5368914204e4ba610a822e2aae8a2273b2c4daaf5e36ab4d06df386907d1d
