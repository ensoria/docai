> docai-messaging: 0.17.1 | profile: compact | perspective: storefront | coverage: complete | knowledge: complete | source_refs: all

Full set: ../full/

# Messaging Index

## Sources

| ID | Kind | Specification | API | Contract version | Location | Revision |
|---|---|---|---|---|---|---|
| complete-contexts | behavior-configuration | none | none | none | complete-contexts.json | fixture-1 |
| storefront-asyncapi-3.1.0 | asyncapi | AsyncAPI 3.1.0 | urn:example:storefront-order-messaging | 1.0.0 | storefront.asyncapi.json | 1.0.0 |
| storefront-behavior | behavior-configuration | none | none | none | storefront-behavior.json | fixture-1 |

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

> docai-identity: set_id: b32:4z2svaz5yrze67ovtveyeemmze | projection_id: b32:3k44labglirnz7fi4as5h2rkba | set_digest: sha256:e6752a833dc4724f7dd59d4982118cc99f9efa1112715e21f11dffafdfb0869b | projection_digest: sha256:dab9c580265a22dcfca8e025d3ea2a089f2f1609e0f6092603fb886d48efde1e
