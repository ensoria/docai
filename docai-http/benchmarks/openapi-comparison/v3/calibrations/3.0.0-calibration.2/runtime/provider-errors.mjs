export class ProviderTransportError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderTransportError";
    this.category = "transport_error";
    this.retryable = true;
    this.usable_response = false;
  }
}

export class ProviderResponseError extends Error {
  constructor(message, {
    httpStatus = null,
    category = "provider_error",
    stopReason = null,
    providerRequestId = null,
    responseBody = null,
  } = {}) {
    super(message);
    this.name = "ProviderResponseError";
    this.http_status = httpStatus;
    this.category = category;
    this.stop_reason = stopReason;
    this.provider_request_id = providerRequestId;
    this.response_body = responseBody;
    this.retryable = false;
    this.usable_response = true;
  }
}
