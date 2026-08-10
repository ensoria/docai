export function diagnostic(ruleId, file, line, message, severity = "error", cascade = false) {
  return { ruleId, file, line, message, severity, cascade };
}
