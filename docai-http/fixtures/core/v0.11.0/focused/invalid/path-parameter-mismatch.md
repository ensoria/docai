# invalid: path parameter mismatch

Expected: invalid. The endpoint path uses `{id}` but the path parameter table documents `user_id`.

```markdown
## GET /users/{id}

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| user_id | string | User ID |
```
