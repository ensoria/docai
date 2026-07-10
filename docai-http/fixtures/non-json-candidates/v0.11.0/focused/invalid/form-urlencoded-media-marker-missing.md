# invalid: form-urlencoded media marker missing charset

Expected: invalid non-JSON candidate. Form-urlencoded request bodies must include the media type with its UTF-8 charset.

````markdown
#### Body

**body_required**: yes

**media_type**: application/x-www-form-urlencoded

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

q=quarterly+statement&tag=finance&tag=quarterly&include_archived=false
```

Encode the form body as UTF-8 before percent-encoding. Encode spaces as `+`. Repeated `tag` values are sent by repeating the `tag` field once per value; order is not significant.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; encode as UTF-8 before percent-encoding; spaces use `+`; empty string rejected |
| tag | string[] | no | no | Form field `tag`; repeat the field once per value, such as `tag=finance&tag=quarterly`; order is not significant; omit the field when the list is empty |
````
