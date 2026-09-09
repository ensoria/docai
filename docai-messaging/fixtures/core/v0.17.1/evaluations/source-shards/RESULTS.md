# Source Shard Token Evidence

- DocAI Messaging: `0.17.1`
- Projection ID: `b32:472fl7j3appoqc7pslwez2wwlq`
- Projection digest: `sha256:e7f455fd3b03dee80bef92ec4cead65c8ad9d7a784ad216dd531495aa6ee860e`
- Tokenizer: `tiktoken==0.13.0` / `o200k_base`
- Evaluated profiles: `full`
- Token budget: `4096`
- Claim scope: `exact source b resolution`
- Cache or billed-token savings claim: `no`

## Per-task totals

| Task | Sharded | Direct | Difference |
|---|---:|---:|---:|
| `resolve-source-b-provenance` | 1672 | 1795 | -123 |

## Nearest-rank aggregates

| Representation | p50 | p95 | Maximum |
|---|---:|---:|---:|
| sharded | 1672 | 1672 | 1672 |
| direct | 1795 | 1795 | 1795 |

## Source-shard trace

### `resolve-source-b-provenance`

- Considered root rows: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-d-y.md, indexes/sources-z.md`
- Loaded source shards: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-z.md`
- False-positive shards: `indexes/sources-a-c.md`
- Transitive shards: `indexes/sources-z.md`
- Unloaded shards: `indexes/sources-d-y.md`
- Fixed point resolved IDs: `a, b, c, z`
- Load-all, full-profile, and whole-CONVENTIONS fallbacks: `no`

## Claim boundary

The scoped Source Shards emission claim is **supported**: maximum savings are 123 tokens (6.852%).
This is not an unqualified DocAI, cache, billed-token, compact-profile, or complete-surface savings claim.

The measurement counts the canonical UTF-8 envelope described in `measurement-input.json`. Component token counts are diagnostic; `boundaryTokenDelta` records tokenizer merges across component boundaries, and `totalTaskInputTokens` is measured from the complete envelope.
