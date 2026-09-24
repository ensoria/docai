> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

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
| alpha task; zeta task | SEND; RECEIVE | a.events | z.events | a-operation | z-operation | a-message | z-message | Broad operation range | indexes/operations-broad.md |
| middle task | SEND | m.events | m.events | m-operation | m-operation | m-message | m-message | Middle operation range | indexes/operations-middle.md |

## Workflows

| Name | Summary | Details |
|---|---|---|
| Alpha delivery | Deliver alpha and record the middle event | workflows/alpha-delivery.md |
| Alpha observability | Observe alpha delivery with synthetic traces | workflows/alpha-observability.md |

> docai-identity: set_id: b32:2rhfjg623pgukhiksu5oesrunu | projection_id: b32:3k44labglirnz7fi4as5h2rkba | set_digest: sha256:d44e549bdadbcd451d0a953ae24a346d65fb46433a9cbf94556e448d581af47c | projection_digest: sha256:dab9c580265a22dcfca8e025d3ea2a089f2f1609e0f6092603fb886d48efde1e
