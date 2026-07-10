# invalid: form-urlencoded repeated field rule missing

Expected: invalid non-JSON candidate. Repeated form fields must state repeat-key encoding, order significance, and empty-list behavior.

````markdown
#### Body

**body_required**: yes

**media_type**: application/x-www-form-urlencoded;charset=UTF-8

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

q=quarterly+statement&tag=finance&tag=quarterly&include_archived=false
```

Encode the form body as UTF-8 before percent-encoding. Encode spaces as `+`.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; encode as UTF-8 before percent-encoding; spaces use `+`; empty string rejected |
| tag | string[] | no | no | Form field `tag`; accepts multiple values |
````
