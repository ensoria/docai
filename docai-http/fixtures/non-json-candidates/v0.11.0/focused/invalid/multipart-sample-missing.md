# invalid: multipart sample missing

Expected: invalid non-JSON candidate. Multipart request bodies must include a representative HTTP sample fragment.

```markdown
#### Body

**body_required**: yes

**media_type**: multipart/form-data

**body_nullable**: no

The caller must delegate multipart boundary construction to the HTTP library and must not hard-code the sample boundary token.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| document | file | yes | no | Multipart part name `document`; filename is required and must preserve the file extension; accepted part Content-Type values are `application/pdf` and `image/png`; maximum size is 10485760 bytes |
| metadata | object | no | no | Multipart part name `metadata`; part Content-Type is `application/json`; maximum serialized size is 4096 bytes; additional properties forbidden |
```
