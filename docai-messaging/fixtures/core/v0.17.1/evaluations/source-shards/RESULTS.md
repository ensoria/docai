# Source Shard Token Evidence

- DocAI Messaging: `0.17.1`
- Projection ID: `b32:472fl7j3appoqc7pslwez2wwlq`
- Projection digest: `sha256:e7f455fd3b03dee80bef92ec4cead65c8ad9d7a784ad216dd531495aa6ee860e`
- Evidence classification: `synthetic-conformance`
- Tokenizer: `tiktoken==0.13.0` / `o200k_base`
- Evaluated profiles: `full`
- Token budget: `4096`
- Claim scope: `exact source b resolution`
- Claim task IDs: `resolve-source-b-provenance`
- Cache or billed-token savings claim: `no`

## Per-task totals

| Task | Control | Emission decision | Sharded | Direct | Difference |
|---|---|---|---:|---:|---:|
| `resolve-source-b-provenance` | positive | `emit-source-shards` | 1674 | 1797 | -123 |
| `resolve-all-source-provenance` | negative | `retain-direct-sources` | 2608 | 1643 | 965 |

## Nearest-rank aggregates

| Representation | p50 | p95 | Maximum |
|---|---:|---:|---:|
| sharded | 1674 | 2608 | 2608 |
| direct | 1643 | 1797 | 1797 |

## Source-shard trace

### `resolve-source-b-provenance`

- Considered root rows: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-d-y.md, indexes/sources-z.md`
- Loaded source shards: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-z.md`
- False-positive shards: `indexes/sources-a-c.md`
- Transitive shards: `indexes/sources-z.md`
- Unloaded shards: `indexes/sources-d-y.md`
- Fixed point resolved IDs: `a, b, c, z`
- Load all sources: `no`
- Load-all fallback: `no`
- Full-profile fallback: `no`
- Whole-CONVENTIONS fallback: `no`

### `resolve-all-source-provenance`

- Considered root rows: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-d-y.md, indexes/sources-z.md`
- Loaded source shards: `indexes/sources-a-c.md, indexes/sources-b.md, indexes/sources-d-y.md, indexes/sources-z.md`
- False-positive shards: ``
- Transitive shards: ``
- Unloaded shards: ``
- Fixed point resolved IDs: `a, b, c, d, e, f, g, h, i, j, k, l, m, n, o, p, q, r, s, t, u, v, w, x, y, z`
- Load all sources: `yes`
- Load-all fallback: `no`
- Full-profile fallback: `no`
- Whole-CONVENTIONS fallback: `no`

## Claim boundary

The scoped Source Shards emission claim is **supported**: maximum savings are 123 tokens (6.845%).
- Unqualified savings supported across all controls: `no`
- Disclosed task regressions: `resolve-all-source-provenance` (+965 tokens)
- Disclosed aggregate regressions: `p50` (+31 tokens), `p95` (+811 tokens), `maximum` (+811 tokens)
This is not an unqualified DocAI, cache, billed-token, compact-profile, or complete-surface savings claim.

The measurement counts the canonical UTF-8 envelope described in `measurement-input.json`. Component token counts are diagnostic; `boundaryTokenDelta` records tokenizer merges across component boundaries, and `totalTaskInputTokens` is measured from the complete envelope.
