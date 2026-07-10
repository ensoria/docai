# invalid: form-urlencoded charset missing

Expected: invalid non-JSON candidate. Form-urlencoded requests must state the character encoding before percent-encoding.

````markdown
#### Body

**body_required**: yes

**media_type**: application/x-www-form-urlencoded;charset=UTF-8

**body_nullable**: no

```http
Content-Type: application/x-www-form-urlencoded

q=quarterly+statement&tag=finance&tag=quarterly&include_archived=false
```

Encode spaces as `+`. Repeated `tag` values are sent by repeating the `tag` field once per value; order is not significant.

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| q | string | yes | no | Form field `q`; spaces use `+`; empty string rejected |
| tag | string[] | no | no | Form field `tag`; repeat the field once per value, such as `tag=finance&tag=quarterly`; order is not significant; omit the field when the list is empty |
````
