export function gradeRequestConstructionRecord(record, task) {
  return gradeRequestConstructionResponse(record.response?.content_json, task);
}

export function gradeEvaluationRecord(record, task) {
  return gradeEvaluationResponse(record.response?.content_json, task);
}

export function gradeEvaluationResponse(response, task) {
  if (task.group === "request_construction") return gradeRequestConstructionResponse(response, task);
  if (task.group === "response_handling") return gradeResponseHandlingResponse(response, task);
  if (task.group === "error_handling") return gradeErrorHandlingResponse(response, task);
  if (task.group === "workflow_completion") return gradeWorkflowCompletionResponse(response, task);
  if (task.group === "token_load") return gradeTokenLoadResponse(response, task);
  return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
}

export function gradeRequestConstructionResponse(response, task) {
  if (task.group !== "request_construction") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  if (!response || typeof response !== "object") {
    return { pass: false, reasons: ["response.content_json is required"] };
  }

  const reasons = [];
  if (response.method !== task.expected_outcome.method) reasons.push(`method expected ${task.expected_outcome.method}`);
  validateExpectedPath(task, response, reasons);
  validateExpectedHeaders(task, response, reasons);
  validateExpectedBody(task, response, reasons);
  validateExpectedParts(task, response, reasons);

  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched request construction expected outcome"] : reasons,
  };
}

export function gradeResponseHandlingResponse(response, task) {
  if (task.group !== "response_handling") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  if (!response || typeof response !== "object") {
    return { pass: false, reasons: ["response.content_json is required"] };
  }

  const reasons = [];
  if (Number(response.success_status) !== Number(task.expected_outcome.success_status)) {
    reasons.push(`success_status expected ${task.expected_outcome.success_status}`);
  }
  validateExpectedResponseBodyHandling(task, response, reasons);
  validateExpectedResponseHeaders(task, response, reasons);
  validateExpectedRelatedFollowups(task, response, reasons);

  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched response handling expected outcome"] : reasons,
  };
}

export function gradeErrorHandlingResponse(response, task) {
  if (task.group !== "error_handling") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  if (!response || typeof response !== "object") {
    return { pass: false, reasons: ["response.content_json is required"] };
  }

  const reasons = [];
  const endpointErrors = normalizeErrorList(response.endpoint_errors);
  const commonErrors = normalizeErrorList(response.common_errors);
  const allErrors = [...endpointErrors, ...commonErrors];
  validateExpectedErrorSet("endpoint_errors", task.expected_outcome.endpoint_errors ?? [], endpointErrors, allErrors, reasons);
  validateExpectedErrorSet("common_errors", task.expected_outcome.common_errors ?? [], commonErrors, allErrors, reasons);

  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched error handling expected outcome"] : reasons,
  };
}

export function gradeWorkflowCompletionResponse(response, task) {
  if (task.group !== "workflow_completion") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  if (!response || typeof response !== "object") {
    return { pass: false, reasons: ["response.content_json is required"] };
  }

  const reasons = [];
  const steps = normalizeWorkflowSteps(response.steps);
  const stepTexts = steps.map((step) => searchableText(step));
  const expectedSteps = task.expected_outcome.steps ?? [];
  const matchedIndexes = findWorkflowStepIndexes(stepTexts, expectedSteps, reasons);
  expectedSteps.forEach((expected, index) => {
    const actualText = stepTexts[matchedIndexes[index]];
    if (!actualText) return;
    validateWorkflowStep(index + 1, expected, actualText, reasons);
  });
  validateWorkflowFailureRecovery(task, response, reasons);
  validateWorkflowWebhookReconciliation(task, response, reasons);

  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched workflow completion expected outcome"] : reasons,
  };
}

export function gradeTokenLoadResponse(response, task) {
  if (task.group !== "token_load") {
    return { pass: false, reasons: [`no automated grader for task group ${task.group}`] };
  }
  if (!response || typeof response !== "object") {
    return { pass: false, reasons: ["response.content_json is required"] };
  }

  const reasons = [];
  const metrics = normalizeProfileMetrics(response.loaded_contexts ?? response.metrics_by_profile);
  const full = metrics.get("full");
  const compact = metrics.get("compact");
  if (!full) reasons.push("token_load metrics must include full context");
  if (!compact) reasons.push("token_load metrics must include compact context");
  [full, compact].filter(Boolean).forEach((metric) => validateTokenMetric(metric, reasons));
  if (
    full &&
    compact &&
    task.expected_outcome.compact_chars_must_not_exceed_full_chars &&
    Number(compact.characters) > Number(full.characters)
  ) {
    reasons.push("compact context must not exceed full context characters");
  }

  return {
    pass: reasons.length === 0,
    reasons: reasons.length === 0 ? ["matched token-load expected outcome"] : reasons,
  };
}

function normalizeProfileMetrics(value) {
  if (Array.isArray(value)) {
    return new Map(value.map((metric) => [metric.profile ?? metric.context ?? metric.label, metric]));
  }
  if (value && typeof value === "object") {
    return new Map(Object.entries(value).map(([profile, metric]) => [profile, { profile, ...metric }]));
  }
  return new Map();
}

function validateTokenMetric(metric, reasons) {
  ["utf8_bytes", "characters", "approx_tokens_chars_div_4"].forEach((field) => {
    if (!Number.isInteger(Number(metric[field])) || Number(metric[field]) <= 0) {
      reasons.push(`token_load ${metric.profile ?? "metric"} must include positive ${field}`);
    }
  });
}

function normalizeWorkflowSteps(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function findWorkflowStepIndexes(stepTexts, expectedSteps, reasons) {
  const indexes = [];
  let searchFrom = 0;
  expectedSteps.forEach((expected, index) => {
    const found = stepTexts.findIndex((text, actualIndex) => {
      return actualIndex >= searchFrom && containsToken(text, expected.method) && workflowPathMatches(text, expected.path);
    });
    if (found === -1) {
      reasons.push(`step ${index + 1} expected ${expected.method} ${expected.path}`);
      indexes.push(-1);
      return;
    }
    indexes.push(found);
    searchFrom = found + 1;
  });
  return indexes;
}

function validateWorkflowStep(stepNumber, expected, actualText, reasons) {
  (expected.pass ?? []).forEach((value) => {
    if (!workflowValueMatches(actualText, value)) reasons.push(`step ${stepNumber} must pass ${value}`);
  });
  (expected.keep ?? []).forEach((value) => {
    if (!containsToken(actualText, value)) reasons.push(`step ${stepNumber} must keep ${value}`);
  });
  if (expected.state_after_success && !containsToken(actualText, expected.state_after_success)) {
    reasons.push(`step ${stepNumber} must reach ${expected.state_after_success}`);
  }
}

function validateWorkflowFailureRecovery(task, response, reasons) {
  const text = searchableText(response.failure_recovery ?? response.retryable_order_failure ?? response);
  const fullText = searchableText(response);
  const requiredTokens = ["post /orders", "cart_id", "payment_id", "retry"];
  requiredTokens.forEach((token) => {
    if (!containsToken(text, token)) reasons.push(`failure_recovery must include ${token}`);
  });
  if (!containsToken(text, "payment.pending") && !containsToken(fullText, "payment.pending")) {
    reasons.push("failure_recovery must include payment.pending");
  }
}

function validateWorkflowWebhookReconciliation(task, response, reasons) {
  const text = searchableText(response.webhook_reconciliation ?? response.early_webhook_reconciliation ?? response);
  ["payment.completed", "payment_id"].forEach((token) => {
    if (!containsToken(text, token)) reasons.push(`webhook_reconciliation must include ${token}`);
  });
}

function workflowPathMatches(text, expectedPath) {
  if (containsToken(text, expectedPath)) return true;
  const pattern = escapeRegExp(expectedPath)
    .replace(/\\\{[^}]+\\\}/g, "[a-z0-9_:-]+")
    .replace(/\\\//g, "\\/");
  return new RegExp(pattern, "i").test(text);
}

function workflowValueMatches(text, expectedValue) {
  if (containsToken(text, expectedValue)) return true;
  if (expectedValue === "type=card") return containsToken(text, "type") && containsToken(text, "card");
  return false;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validateExpectedErrorSet(label, expectedErrors, primaryErrors, fallbackErrors, reasons) {
  expectedErrors.forEach((expected) => {
    const match =
      primaryErrors.find((actual) => errorMatches(actual, expected)) ??
      fallbackErrors.find((actual) => errorMatches(actual, expected));
    if (!match) {
      reasons.push(`${label} missing status ${expected.status} code ${expected.code}`);
      return;
    }
    if (expected.shape && !shapeMatches(match, expected.shape)) {
      reasons.push(`${label} ${expected.code} must include shape ${expected.shape}`);
    }
    if (expected.action) {
      const actionText = searchableText(match.action ?? match.caller_action ?? match.callerAction ?? match);
      expected.action
        .split(/[.;]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((part) => {
          if (!actionIncludes(actionText, part)) reasons.push(`${label} ${expected.code} action must include ${part}`);
        });
    }
  });
}

function normalizeErrorList(value) {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.values(value).flat();
  return [];
}

function errorMatches(actual, expected) {
  const text = searchableText(actual);
  return containsToken(text, String(expected.status)) && containsToken(text, expected.code);
}

function shapeMatches(actual, expectedShape) {
  const text = searchableText(actual);
  if (containsToken(text, expectedShape)) return true;
  const unscopedShape = String(expectedShape).split(":").pop();
  return containsToken(text, unscopedShape);
}

function actionIncludes(actionText, expectedPart) {
  const normalizedExpected = expectedPart.toLowerCase();
  if (actionText.includes(normalizedExpected)) return true;
  if (normalizedExpected.includes("do not retry") && actionText.includes("do not retry")) return true;
  if (normalizedExpected.includes("refresh once") && actionText.includes("refresh") && actionText.includes("once")) return true;
  if (normalizedExpected.includes("retry once") && actionText.includes("retry") && actionText.includes("once")) return true;
  return false;
}

function validateExpectedResponseBodyHandling(task, response, reasons) {
  const bodyText = searchableText(response.body_handling);
  (task.expected_outcome.body_fields ?? []).forEach((field) => {
    if (!containsToken(bodyText, field)) reasons.push(`body_handling must include field ${field}`);
  });
  if (task.expected_outcome.status_value && !containsToken(bodyText, task.expected_outcome.status_value)) {
    reasons.push(`body_handling must include status value ${task.expected_outcome.status_value}`);
  }
}

function validateExpectedResponseHeaders(task, response, reasons) {
  const expected = task.expected_outcome.response_headers;
  if (expected !== "none") return;
  const actual = response.headers ?? response.response_headers;
  if (actual === "none" || actual === null) return;
  if (Array.isArray(actual) && actual.length === 0) return;
  if (actual && typeof actual === "object" && Object.keys(actual).length === 0) return;
  reasons.push("headers expected none");
}

function validateExpectedRelatedFollowups(task, response, reasons) {
  const relatedText = searchableText(response.related_followups ?? response.related);
  (task.expected_outcome.related ?? []).forEach((relativePath) => {
    if (!containsToken(relatedText, relativePath)) reasons.push(`related_followups must include ${relativePath}`);
  });
}

function searchableText(value) {
  if (typeof value === "string") return value.toLowerCase();
  return JSON.stringify(value ?? "").toLowerCase();
}

function containsToken(text, token) {
  return text.includes(String(token).toLowerCase());
}

function validateExpectedPath(task, response, reasons) {
  const acceptedPaths = task.expected_outcome.accepted_paths ?? [task.expected_outcome.path];
  const normalizedActual = normalizePath(response.path);
  const normalizedExpected = acceptedPaths.map((value) => normalizePath(value));
  if (!normalizedExpected.includes(normalizedActual)) {
    reasons.push(`path expected one of ${acceptedPaths.join(", ")}`);
  }
}

function normalizePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    if (/^https?:\/\//i.test(raw)) {
      const url = new URL(raw);
      return trimTrailingSlash(`${url.pathname}${url.search}`);
    }
  } catch {
    return trimTrailingSlash(raw);
  }
  return trimTrailingSlash(raw);
}

function trimTrailingSlash(value) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

function validateExpectedHeaders(task, response, reasons) {
  if (!Array.isArray(task.expected_outcome.headers)) return;
  const actualHeaders = normalizeHeaders(response.headers);
  task.expected_outcome.headers.forEach((header) => {
    const { name, value: expectedValue } = parseHeader(header);
    const actualValue = actualHeaders.get(name);
    if (!actualValue) {
      reasons.push(`missing header ${name}`);
      return;
    }
    if (!headerValueMatches(name, expectedValue, actualValue)) reasons.push(`header ${name} expected ${expectedValue}`);
  });
}

function parseHeader(header) {
  const separator = header.indexOf(":");
  return {
    name: header.slice(0, separator).trim().toLowerCase(),
    value: header.slice(separator + 1).trim().toLowerCase(),
  };
}

function headerValueMatches(name, expectedValue, actualValue) {
  if (name === "authorization" && expectedValue === "bearer <access_token>") {
    return /^bearer\s+\S+$/i.test(actualValue);
  }
  if (name === "content-type") {
    return mediaType(actualValue) === mediaType(expectedValue);
  }
  return actualValue === expectedValue;
}

function mediaType(value) {
  return String(value ?? "").split(";")[0].trim().toLowerCase();
}

function normalizeHeaders(headers) {
  if (Array.isArray(headers)) {
    return new Map(headers.map((header) => {
      const { name, value } = parseHeader(header);
      return [name, value];
    }));
  }
  if (headers && typeof headers === "object") {
    return new Map(Object.entries(headers).map(([name, value]) => [name.toLowerCase(), String(value).trim().toLowerCase()]));
  }
  return new Map();
}

function validateExpectedBody(task, response, reasons) {
  if (!task.expected_outcome.body) return;
  if (!response.body || typeof response.body !== "object" || Array.isArray(response.body)) {
    reasons.push("response body object is required");
    return;
  }
  Object.entries(task.expected_outcome.body).forEach(([key, value]) => {
    if (response.body[key] !== value) reasons.push(`body.${key} expected ${value}`);
  });
  (task.expected_outcome.omit_optional_fields ?? []).forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(response.body, field)) reasons.push(`optional field ${field} should be omitted`);
  });
}

function validateExpectedParts(task, response, reasons) {
  if (!Array.isArray(task.expected_outcome.parts)) return;
  const actualParts = normalizeParts(response);
  task.expected_outcome.parts.forEach((expectedPart) => {
    const actualPart = actualParts.get(expectedPart.name);
    if (!actualPart) {
      reasons.push(`missing multipart part ${expectedPart.name}`);
      return;
    }
    validateExpectedFilename(expectedPart, actualPart, reasons);
    validateExpectedPartContentType(expectedPart, actualPart, reasons);
  });
  validateMultipartBoundary(task, response, reasons);
}

function validateExpectedFilename(expectedPart, actualPart, reasons) {
  if (expectedPart.filename && actualPart.filename !== expectedPart.filename) {
    reasons.push(`multipart part ${expectedPart.name} filename expected ${expectedPart.filename}`);
    return;
  }
  if (expectedPart.filename_required && !actualPart.filename && actualPart.filename_required !== true) {
    reasons.push(`multipart part ${expectedPart.name} requires filename`);
  }
}

function validateExpectedPartContentType(expectedPart, actualPart, reasons) {
  const actualContentType = partContentType(actualPart);
  if (expectedPart.content_type && actualContentType !== expectedPart.content_type) {
    reasons.push(`multipart part ${expectedPart.name} content_type expected ${expectedPart.content_type}`);
    return;
  }
  if (Array.isArray(expectedPart.allowed_content_types)) {
    if (!actualContentType) {
      reasons.push(`multipart part ${expectedPart.name} content_type must be one of ${expectedPart.allowed_content_types.join(", ")}`);
      return;
    }
    if (!expectedPart.allowed_content_types.includes(actualContentType)) {
      reasons.push(`multipart part ${expectedPart.name} content_type must be one of ${expectedPart.allowed_content_types.join(", ")}`);
    }
  }
}

function partContentType(part) {
  const direct = part.content_type ?? part.contentType ?? part.media_type ?? part.mediaType;
  if (direct) return mediaType(direct);
  return mediaType(normalizeHeaders(part.headers).get("content-type"));
}

function validateMultipartBoundary(task, response, reasons) {
  if (!task.expected_outcome.content_type) return;
  const contentType = String(
    response.content_type ?? response.contentType ?? response.headers?.["Content-Type"] ?? response.headers?.["content-type"] ?? "",
  ).toLowerCase();
  if (!contentType.includes("multipart/form-data")) reasons.push("content_type must include multipart/form-data");
  if (task.expected_outcome.boundary_handling !== "library-generated") return;

  const boundaryText = [
    response.boundary_handling,
    response.boundaryHandling,
    response.boundary,
    response.multipart_boundary,
    response.multipartBoundary,
    contentType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!/\b(library|delegate|delegated|generated|http client|http library)\b/.test(boundaryText)) {
    reasons.push("multipart boundary delegation must be represented");
  }
}

function normalizeParts(response) {
  const rawParts = response.parts ?? response.body?.parts ?? response.body;
  if (!Array.isArray(rawParts)) return new Map();
  return new Map(rawParts.filter((part) => part && part.name).map((part) => [part.name, part]));
}
