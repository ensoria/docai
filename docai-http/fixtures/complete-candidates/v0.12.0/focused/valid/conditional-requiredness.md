# valid: conditional requiredness

Expected: valid complete candidate. `Required=conditional` retains the column and states the exact condition.

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
| card_token | string | conditional | no | Required when `type=card`; omit when `type=bank` |
| bank_account_id | string | conditional | no | Required when `type=bank`; omit when `type=card` |
````
