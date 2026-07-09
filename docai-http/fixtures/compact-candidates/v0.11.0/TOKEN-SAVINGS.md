# Compact Candidate Token-Saving Notes

These notes describe the intended token-saving evidence for the compact candidate fixtures. They are candidate guidance only; they do not promote the compact profile into the current Compatibility Core.

## Measurement Policy

Use tokenizer-specific measurements when deciding whether a compact reduction is worthwhile for a producer. Token counts without an exact tokenizer identifier are not comparable, so this candidate corpus does not publish a normative token count.

For each compact candidate, record:

- Tokenizer name and version, when available.
- Full-profile file path and compact-profile file path.
- Full-profile token count.
- Compact-profile token count.
- Absolute and percentage reduction.
- The reductions used, such as compact examples or `field_defaults`.
- Confirmation that the compact file preserves every client-visible contract item from the matching full file.

When tokenizer inputs are unavailable, treat the measured-savings condition for `field_defaults` as a producer assertion and verify only syntax, placement, logical column reconstruction, and client-visible contract preservation.

## Current Candidate Annotations

| Full file | Compact file | Candidate reductions | Contract preservation check |
|---|---|---|---|
| `valid/full/resources/users.md` | `valid/compact/resources/users.md` | Compact request example omits optional `role`; `field_defaults` omits uniform `Nullable`, `Presence`, and response-header `Presence` columns. | Compact output retains request fields, response fields, response header, requiredness/presence/nullability defaults, constraints, behavior, errors, and related sections. |

## Suggested Measurement Record

```markdown
### <fixture path>

- tokenizer:
- full_tokens:
- compact_tokens:
- reduction_tokens:
- reduction_percent:
- reductions_used:
- client_visible_contract_preserved: yes|no
- notes:
```

Do not add token-count metadata to fixture stamps unless it has retrieval value for the intended reader and repays its own tokens. If a future candidate uses stamp or INDEX `x-` token-routing metadata, keep that evidence separate from this first compact candidate scope.
