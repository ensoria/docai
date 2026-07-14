# invalid: path parameter name mismatch

Expected: invalid complete candidate. Path parameter rows must exactly match the endpoint path template variables.

````markdown
## GET /users/{id}/devices/{device_id}

Gets a registered device for one user.

### Request

#### Path Parameters

| Name | Type | Constraints / Meaning |
|---|---|---|
| user_id | string | User ID returned by POST /users |
| device_id | string | Device ID returned by POST /users/{id}/devices |

#### Query Parameters

none

#### Headers

none

#### Cookie Parameters

none

#### Body

none
````
