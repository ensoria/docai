# invalid: bodyless request missing none

Expected: invalid complete candidate. A body-less request does not explicitly collapse the Body subsection to `none`.

````markdown
## DELETE /sessions/{id}

### Request

- Path Parameters:

| Name | Type | Required | Constraints / Meaning |
|---|---|---|---|
| id | string | yes | Session ID |

- Query Parameters: none
- Headers: none
- Cookie Parameters: none

### Response 204

none
````
