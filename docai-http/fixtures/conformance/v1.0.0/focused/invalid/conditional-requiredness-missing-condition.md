# invalid: conditional requiredness missing condition

Expected: invalid complete conformance. `Required=conditional` must state the exact condition in `Constraints / Meaning`.

````markdown
#### Body

**body_required**: yes

**media_type**: application/json

**body_nullable**: no

```json
{"type":"card","card_token":"card_01K0COMPLETE"}
```

| Field | Type | Required | Nullable | Constraints / Meaning |
|---|---|---|---|---|
| type | string | yes | no | `card` \| `bank` |
| card_token | string | conditional | no | Payment method token |
````
