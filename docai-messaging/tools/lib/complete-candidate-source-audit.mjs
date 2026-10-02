import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { validateCompleteDocumentSet } from "./validators/complete.mjs";
import { validateCompleteFieldDefaults } from "./validators/complete-field-defaults.mjs";
import { validateCompleteSameAs } from "./validators/complete-same-as.mjs";
import { parsePipeTable } from "./tables.mjs";

const sourceFiles = new Map([
  ["complete-contexts", "complete-contexts.json"],
  ["complete-representations", "complete-representations.json"],
  ["storefront-asyncapi-3.1.0", "storefront.asyncapi.json"],
  ["storefront-behavior", "storefront-behavior.json"]
]);

function section(text, heading) {
  if (typeof text !== "string") return null;
  const lines = text.split("\n");
  const start = lines.indexOf(heading);
  if (start < 0) return null;
  const level = heading.match(/^#+/)[0].length;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#+ /.test(line) && line.match(/^#+/)[0].length <= level);
  return (end < 0 ? rest : rest.slice(0, end))
    .filter((line) => !line.startsWith("> docai-identity:"))
    .join("\n").trim();
}

function fieldTables(text) {
  if (typeof text !== "string") return [];
  return [...text.matchAll(/^\| Field \|[^\n]*\n(?:\|[^\n]*\n?)+/gm)].map(([table]) => {
    const parsed = parsePipeTable(table.trimEnd().split("\n").map((line, index) => ({
      text: line, file: "representation", line: index + 1
    })));
    return parsed.diagnostics.length === 0 ? parsed.value.rows : null;
  });
}

function expectedVariantRows(entry, variant) {
  const schema = variant.schema;
  if (schema?.type !== "object" || schema.additionalProperties !== false
      || !Array.isArray(schema.required) || !schema.properties) return null;
  const presence = entry.action === "SEND" ? "yes" : "always";
  const properties = Object.entries(schema.properties);
  if (properties.some(([name, field]) => !schema.required.includes(name)
      || field.type !== "string" || typeof field.description !== "string")) return null;
  return [
    ["$", "object", presence, "no", "Additional properties are forbidden."],
    ...properties.map(([name, field]) => [
      name, field.type, presence, "no",
      Object.hasOwn(field, "const")
        ? `\`const=${JSON.stringify(field.const)}\`; ${field.description}`
        : field.description
    ])
  ];
}

export function auditCompleteCandidateSources(candidatePath, documentSets, options) {
  const manifestPath = path.join(candidatePath, "source", "projection-input-manifest.json");
  if (!fs.existsSync(manifestPath)) return [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (manifest.generator?.id !== "docai-messaging-complete-fixture-projector") {
    return ["generator identity differs from the complete candidate projection policy"];
  }

  const issues = [];
  const sources = new Map();
  if (!Array.isArray(manifest.sources) || manifest.sources.length !== sourceFiles.size
      || manifest.sources.some((entry) => !sourceFiles.has(entry.sourceId))) {
    issues.push("unexpected source binding in the complete candidate manifest");
  }
  for (const [id, filename] of sourceFiles) {
    const entries = manifest.sources?.filter((entry) => entry.sourceId === id) ?? [];
    if (entries.length !== 1 || entries[0].location !== filename) {
      issues.push(`${id}: expected exactly one ${filename} source binding`);
      continue;
    }
    const sourcePath = path.join(candidatePath, "source", filename);
    if (!fs.existsSync(sourcePath)) {
      issues.push(`${id}: source file is missing`);
      continue;
    }
    const bytes = fs.readFileSync(sourcePath);
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (entries[0].sha256 !== digest) {
      issues.push(`${id}: source digest differs from the projection manifest`);
      continue;
    }
    try {
      sources.set(id, JSON.parse(bytes.toString("utf8")));
    } catch {
      issues.push(`${id}: source JSON is invalid`);
    }
  }
  if (issues.length > 0) return issues;

  const contexts = sources.get("complete-contexts");
  const representations = sources.get("complete-representations");
  const asyncapi = sources.get("storefront-asyncapi-3.1.0");
  const behavior = sources.get("storefront-behavior");
  const expectedSourceRows = new Map();
  for (const [id] of sourceFiles) {
    const binding = manifest.sources.find((entry) => entry.sourceId === id);
    const source = sources.get(id);
    const isAsyncapi = id === "storefront-asyncapi-3.1.0";
    const sourceRevision = isAsyncapi ? source.info?.version : source.revision;
    if (!isAsyncapi && (source.sourceId !== id || source.kind !== binding.type)) {
      issues.push(`${id}: source identity or kind differs from its Sources binding`);
    }
    if (sourceRevision !== binding.revision) {
      issues.push(`${id}: Sources Revision differs from the source contract version`);
    }
    if (isAsyncapi && binding.specification !== `AsyncAPI ${source.asyncapi}`) {
      issues.push(`${id}: Sources Specification differs from the source AsyncAPI version`);
    }
    expectedSourceRows.set(id, {
      kind: binding.type,
      specification: binding.specification,
      api: isAsyncapi ? source.id : "none",
      contractVersion: isAsyncapi ? source.info?.version : "none",
      location: binding.location,
      revision: binding.revision
    });
  }
  if (issues.length > 0) return issues;
  for (const [profile, set] of Object.entries(documentSets)) {
    const result = validateCompleteDocumentSet(set, options);
    const expanded = validateCompleteSameAs(validateCompleteFieldDefaults(set).expandedDocumentSet)
      .expandedDocumentSet;
    const check = (condition, label) => {
      if (!condition) issues.push(`${profile}: ${label} differs from authoritative source`);
    };
    const operationBody = (name) => {
      const definition = result.facts.core.operationDefinitions.byName[name];
      const file = expanded.files.find((entry) => entry.path === definition?.path);
      return section(file?.content, `## ${definition?.action} ${definition?.channel} (${name})`);
    };
    for (const file of set.files) {
      check(file.metadata.perspective === manifest.perspective.application,
        `${file.path} perspective`);
      check(file.metadata["docai-messaging"] === manifest.docaiMessaging,
        `${file.path} DocAI Messaging version`);
    }
    const conventions = set.files.find((file) => file.path === "CONVENTIONS.md");
    const convention = (heading) => section(conventions?.content, `## ${heading}`);
    const environments = Object.entries(behavior.environments ?? {});
    const [environmentName, environment] = environments[0] ?? [];
    const server = asyncapi.servers?.[environment?.server];
    const selectedServer = `the ${environmentName} server`;
    const expectedEnvironment = environment?.selection?.replace(
      selectedServer, `the \`${environmentName}\` server at \`${server?.host}\``
    );
    check(environments.length === 1 && environment?.server === environmentName
      && typeof server?.host === "string" && server.host.length > 0
      && environment.selection.includes(selectedServer)
      && convention("Environments") === expectedEnvironment,
    "CONVENTIONS Environments");
    const bindings = behavior.protocolsAndBindings;
    const protocol = bindings?.protocol;
    const expectedProtocols = `Use ${protocol?.[0]?.toUpperCase()}${protocol?.slice(1)} protocol version `
      + `\`${bindings?.protocolVersion}\`. ${bindings?.headerEncoding?.replace(/\.$/, "")}, and `
      + bindings?.clientExposure?.replace(/^Expose /, "clients expose ");
    check(server?.protocol === protocol && server?.protocolVersion === bindings?.protocolVersion
      && convention("Protocols and Bindings") === expectedProtocols,
    "CONVENTIONS Protocols and Bindings");
    const authentication = behavior.authentication;
    const authorization = behavior.authorization;
    const securedOperations = Object.entries(asyncapi.operations ?? {});
    const tokenUrl = securedOperations[0]?.[1]?.security?.[0]?.flows?.clientCredentials?.tokenUrl;
    const credentialAcquisition = authentication?.credentialAcquisition?.replace(
      "a client-credentials token from the configured synthetic authorization service.",
      `a token from \`${tokenUrl}\` with the operation-specific scope`
    );
    const credentialRotation = authentication?.credentialRotation?.replace(
      /^Acquire /, "acquire "
    );
    const expectedAuthentication = `Use the \`${authentication?.scheme}\` OAuth2 client-credentials scheme. `
      + `${credentialAcquisition}, and ${credentialRotation}`;
    check(typeof authentication?.scheme === "string" && authentication.scheme.length > 0
      && typeof tokenUrl === "string" && tokenUrl.length > 0
      && authorization?.scheme === authentication.scheme
      && securedOperations.length > 0
      && isDeepStrictEqual(
        Object.keys(authorization).filter((name) => name !== "scheme").sort(),
        securedOperations.map(([name]) => name).sort()
      )
      && securedOperations.every(([name, operation]) => {
        const security = operation.security?.[0];
        const flow = security?.flows?.clientCredentials;
        const scopes = security?.scopes;
        const expectedScopes = authorization[name];
        return operation.security?.length === 1 && security?.type === "oauth2"
          && Object.keys(security.flows ?? {}).length === 1
          && flow?.tokenUrl === tokenUrl
          && Array.isArray(scopes) && scopes.length > 0
          && new Set(scopes).size === scopes.length
          && Array.isArray(expectedScopes)
          && isDeepStrictEqual([...scopes].sort(), [...expectedScopes].sort())
          && scopes.every((scope) => Object.hasOwn(flow.availableScopes ?? {}, scope));
      })
      && convention("Authentication") === expectedAuthentication,
    "CONVENTIONS Authentication");
    const serialization = behavior.serialization;
    const resolveRef = (value) => value?.$ref?.startsWith("#/")
      ? value.$ref.slice(2).split("/").reduce((node, key) => node?.[key], asyncapi) : null;
    const selectedMessageRefs = Object.values(asyncapi.operations ?? {}).flatMap((operation) => [
      ...(operation.messages ?? []), ...(operation.reply?.messages ?? [])
    ]);
    const expectedSerialization = `Use ${serialization?.encoding} with media type `
      + `\`${serialization?.wireMediaType}\`. `
      + serialization?.schemaResolution?.replace("the client does", "clients do");
    check(serialization?.wireMediaType === asyncapi.defaultContentType
      && selectedMessageRefs.length > 0
      && selectedMessageRefs.every((ref) => resolveRef(resolveRef(ref))?.contentType
        === serialization.wireMediaType)
      && convention("Serialization") === expectedSerialization,
    "CONVENTIONS Serialization");
    const envelope = behavior.messageEnvelope;
    check(convention("Message Envelope") === `Use \`${envelope.messageIdHeader}\` as the message identifier, `
      + `\`${envelope.correlationIdHeader}\` as the correlation identifier, and `
      + `\`${envelope.replyAddressHeader}\` as the reply address.`,
    "CONVENTIONS Message Envelope");
    const redelivery = behavior.delivery.redeliveryVisibility.replaceAll(
      envelope.messageIdHeader, `\`${envelope.messageIdHeader}\``
    );
    const positiveAck = behavior.acknowledgement.positive.replace(/\.$/, "");
    const negativeAck = behavior.acknowledgement.nack.replace(/^./, (letter) => letter.toLowerCase());
    check(convention("Delivery Semantics") === [
      `Delivery is ${behavior.delivery.guarantee}.`,
      redelivery,
      `${positiveAck}; ${negativeAck}`,
      behavior.acknowledgement.timeout
    ].join(" "), "CONVENTIONS Delivery Semantics");
    check(convention("Idempotency and Deduplication")
      === `Deduplicate by \`${behavior.deduplication.key}\` for `
        + `${behavior.deduplication.retention} ${behavior.deduplication.scope}.`,
    "CONVENTIONS Idempotency and Deduplication");
    check(convention("Connection and Session") === [
      behavior.connectionAndSession.reconnect,
      behavior.connectionAndSession.sessionFailure
    ].join(" "), "CONVENTIONS Connection and Session");
    check(convention("Ordering")?.replaceAll("`", "") === [
      behavior.ordering.guarantee,
      behavior.ordering.negativeGuarantee
    ].join(" "), "CONVENTIONS Ordering");
    const recovery = behavior.failureRecovery;
    const retryAction = recovery?.retryAction?.replace("; reject", " and reject");
    const terminalAction = recovery?.terminalAction?.replace(/^Publish /, "publish ")
      .replace("the dead-letter channel", `\`${recovery?.deadLetterChannel}\``);
    check(recovery?.maxDeliveryAttempts === 5
      && typeof recovery.deadLetterChannel === "string" && recovery.deadLetterChannel.length > 0
      && convention("Error Handling") === `${retryAction} After five delivery attempts, ${terminalAction}`,
    "CONVENTIONS Error Handling");
    const requestReply = behavior.requestReply;
    const replyOperations = Object.values(asyncapi.operations ?? {})
      .filter((operation) => operation.reply !== undefined);
    const replyChannel = resolveRef(replyOperations[0]?.reply?.channel);
    const correlation = requestReply?.correlation?.replaceAll(
      envelope.correlationIdHeader, `\`${envelope.correlationIdHeader}\``
    );
    const timeoutMeaning = requestReply?.timeoutMeaning?.replace(
      "No acceptance reply arrived before the deadline; command outcome is",
      "if no acceptance reply arrives, the command outcome is"
    );
    check(replyOperations.length === 1
      && replyChannel?.address === requestReply?.replyChannel
      && convention("Request-Reply") === [
        `Replies use \`${requestReply.replyChannel}\`.`,
        correlation,
        `Wait ${requestReply.timeout} for a reply; ${timeoutMeaning}`
      ].join(" "),
    "CONVENTIONS Request-Reply");
    const schemaEvolution = behavior.schemaEvolution;
    const compatibility = schemaEvolution?.compatibility?.replace("; removing", ". Removing");
    check(typeof schemaEvolution?.logicalApi === "string" && schemaEvolution.logicalApi.length > 0
      && typeof schemaEvolution.contractVersion === "string"
      && schemaEvolution.contractVersion.length > 0
      && schemaEvolution.logicalApi === asyncapi.id
      && schemaEvolution.contractVersion === asyncapi.info?.version
      && convention("Schema Evolution") === `${compatibility} The logical API is `
        + `\`${schemaEvolution.logicalApi}\`, and this corpus projects contract version `
        + `\`${schemaEvolution.contractVersion}\`.`,
    "CONVENTIONS Schema Evolution");
    check(convention("Empty and Omitted Values") === [
      behavior.emptyAndOmittedValues.nullability,
      behavior.emptyAndOmittedValues.omission
    ].join(" "), "CONVENTIONS Empty and Omitted Values");
    const dataRepresentation = convention("Data Representation");
    const formatLines = dataRepresentation?.split("\n");
    const formatTable = formatLines === undefined ? null : parsePipeTable(
      formatLines.map((text, index) => ({
        text, file: "CONVENTIONS.md", line: index + 1
      }))
    );
    const expectedFormats = Object.entries(behavior.dataRepresentation).map(([format, facts]) => [
      JSON.stringify(format), facts.role, facts.meaning
    ]);
    check(formatTable?.diagnostics.length === 0
      && isDeepStrictEqual(formatTable.value?.header, ["Format", "Role", "Meaning"])
      && isDeepStrictEqual(formatTable.value?.rows, expectedFormats)
      && formatTable.value?.endLine === formatLines.length,
    "CONVENTIONS Data Representation");
    check(behavior.rateLimitsAndQuotas.applies === false
      && convention("Rate Limits and Quotas") === "none", "CONVENTIONS Rate Limits and Quotas");
    const actualSourceRows = result.facts.core.sources.rows;
    check(actualSourceRows.length === expectedSourceRows.size, "Sources row count");
    for (const [id, expected] of expectedSourceRows) {
      const actual = actualSourceRows.find((row) => row.id === id);
      for (const [field, value] of Object.entries(expected)) {
        check(actual?.[field] === value, `${id} Sources ${field}`);
      }
    }
    const rowsByFile = new Map();
    for (const row of actualSourceRows) {
      if (!rowsByFile.has(row.file)) rowsByFile.set(row.file, []);
      rowsByFile.get(row.file).push(row.id);
    }
    for (const [filePath, sourceIds] of rowsByFile) {
      const file = set.files.find((entry) => entry.path === filePath);
      const expectedRefs = sourceIds.sort((left, right) => Buffer.compare(
        Buffer.from(left, "ascii"), Buffer.from(right, "ascii")
      )).join(", ");
      check(file?.metadata.source_refs === expectedRefs, `${filePath} Sources source_refs`);
    }
    for (const [name, operation] of Object.entries(asyncapi.operations)) {
      const route = result.facts.core.operations.rows.find((row) => row.operation === name);
      const channelKey = operation.channel?.$ref?.split("/").at(-1);
      const messageKey = operation.messages?.[0]?.$ref?.split("/").at(-1);
      const messageRef = asyncapi.channels[channelKey]?.messages?.[messageKey]?.$ref;
      const messageName = messageRef?.split("/").at(-1);
      const body = operationBody(name);
      const behaviorFacts = behavior.operationBehavior[name];
      check(route?.action === operation.action.toUpperCase()
        && route?.channel === asyncapi.channels[channelKey]?.address,
      `${name} operation route`);
      check(route?.summary === operation.summary, `${name} Summary`);
      check(isDeepStrictEqual(result.facts.core.messageDefinitions.byOperation[name]
        ?.filter((message) => !message.reply).map((message) => message.name), [messageName]),
      `${name} Message identity`);
      const expectedPurpose = name === "sendCreateOrder"
        ? `${behaviorFacts?.purpose} ${behaviorFacts?.reply}` : behaviorFacts?.purpose;
      check(body?.split("\n\n")[0] === expectedPurpose,
        `${name} purpose`);
      const behaviorFields = [
        ["side_effects", "sideEffects"], ["idempotency", "idempotency"],
        ["preconditions", "preconditions"], ["authorization", "authorization"],
        ["delivery", "delivery"], ["ordering", "ordering"]
      ];
      check(behaviorFields.every(([, sourceKey]) => typeof behaviorFacts?.[sourceKey] === "string"
        && behaviorFacts[sourceKey].length > 0)
        && section(body, "### Behavior") === behaviorFields.map(([key, sourceKey]) =>
          `- ${key}: ${behaviorFacts[sourceKey]}`).join("\n"), `${name} Behavior`);
      const scopes = authorization?.[name];
      check(Array.isArray(scopes) && scopes.length === 1
        && behaviorFacts?.authorization === `OAuth2 scope ${scopes[0]} is required.`,
      `${name} Behavior authorization`);
    }
    for (const name of ["receiveOrderCreated", "sendCreateOrder"]) {
      const fields = ["failure", "signal", "condition", "action"];
      const failures = behavior.operationFailures?.[name];
      const expectedRows = Array.isArray(failures) && failures.length > 0
        && failures.every((failure) => fields.every((field) =>
          typeof failure?.[field] === "string" && failure[field].length > 0))
        ? failures.map((failure) => fields.map((field) => failure[field])) : null;
      const lines = section(operationBody(name), "### Failure Handling")?.split("\n");
      const table = lines === undefined ? null : parsePipeTable(lines.map((text, index) => ({
        text, file: "channels/orders.md", line: index + 1
      })));
      check(expectedRows !== null && table?.diagnostics.length === 0
        && isDeepStrictEqual(table.value?.header, ["Failure", "Signal", "Condition", "Action"])
        && isDeepStrictEqual(table.value?.rows, expectedRows)
        && table.value?.endLine === lines.length,
      `${name} Failure Handling`);
    }
    const receiveOperation = asyncapi.operations.receiveOrderCreated;
    const receiveReply = section(operationBody("receiveOrderCreated"), "### Reply");
    check(receiveOperation?.reply === undefined
      && behavior.operationBehavior.receiveOrderCreated?.noReply === true
      && receiveReply === "none", "receiveOrderCreated Reply");
    const sendOperation = asyncapi.operations.sendCreateOrder;
    const sendReply = sendOperation?.reply;
    const sendReplySection = section(operationBody("sendCreateOrder"), "### Reply");
    const replyKeys = sendReplySection?.split("\n\n#### Channel")[0]?.split("\n") ?? [];
    const sendReplyChannel = resolveRef(sendReply?.channel);
    check(replyKeys[0] === `- channel: ${sendReplyChannel?.address}`
      && sendReplyChannel?.address === requestReply.replyChannel,
    "sendCreateOrder Reply channel");
    check(replyKeys[1] === `- correlation: ${requestReply.correlation}`,
      "sendCreateOrder Reply correlation");
    check(replyKeys.length === 3
      && replyKeys[2] === `- timeout: ${requestReply.timeout} -- ${requestReply.timeoutMeaning}`,
    "sendCreateOrder Reply timeout");
    check(sendReplyChannel?.parameters === undefined && sendReplyChannel?.bindings === undefined
      && section(sendReplySection, "#### Channel") === "- Parameters: none\n- Bindings: none",
    "sendCreateOrder Reply Channel");
    const selectedReplyRef = sendReply?.messages?.[0];
    const replyChannelKey = sendReply?.channel?.$ref?.split("/").at(-1);
    const selectedReplyMessage = resolveRef(resolveRef(selectedReplyRef));
    const replyMessageName = selectedReplyMessage?.name;
    const routedSend = result.facts.core.operations.rows
      .find((row) => row.operation === "sendCreateOrder");
    check(sendReply?.messages?.length === 1
      && selectedReplyRef?.$ref?.startsWith(`#/channels/${replyChannelKey}/messages/`)
      && typeof replyMessageName === "string" && replyMessageName.length > 0
      && isDeepStrictEqual(result.facts.core.messageDefinitions.byOperation.sendCreateOrder
        ?.filter((message) => message.reply).map((message) => message.name), [replyMessageName])
      && isDeepStrictEqual(routedSend?.messages?.filter((name) => name.startsWith("reply:")),
        [`reply:${replyMessageName}`]), "sendCreateOrder Reply Message");
    for (const [name, operation] of Object.entries(contexts.operations)) {
      const definition = result.facts.core.operationDefinitions.byName[name];
      const body = operationBody(name);
      check(definition?.action === operation.action && definition?.channel === operation.channel,
        `${name} operation route`);
      check(isDeepStrictEqual(result.facts.core.messageDefinitions.byOperation[name]?.map((m) => m.name),
        [operation.message]), `${name} Message identity`);
      check(section(body, "#### Payload") === operation.payload, `${name} Payload`);
    }
    for (const source of [contexts, representations]) {
      const entries = source.representations ?? Object.entries(source.operations)
        .map(([operation, facts]) => ({ operation, ...facts }));
      const policy = source.operationDefaults;
      for (const entry of entries) {
        const name = entry.operation;
        const contract = source.operationContracts?.[name] ?? entry;
        const body = operationBody(name);
        check(body?.split("\n\n")[0] === contract.purpose, `${name} purpose`);
        check(section(body, "### Behavior") === Object.entries(policy.behavior)
          .map(([key, value]) => `- ${key}: ${value}`).join("\n"), `${name} Behavior`);
        for (const [heading, value] of [
          ["### Operation Bindings", policy.operationBindings],
          ["#### Headers", policy.headers], ["#### Bindings", policy.messageBindings],
          ["### Reply", policy.reply], ["### Failure Handling", policy.failureHandling]
        ]) {
          check(value === "none" && section(body, heading) === value, `${name} ${heading.slice(4)}`);
        }
        check(section(body, "### Channel")
          === `- Parameters: ${policy.channelParameters}\n- Bindings: ${policy.channelBindings}`,
        `${name} Channel`);
      }
    }
    for (const id of ["alpha-delivery", "alpha-observability"]) {
      const source = contexts.workflows[id];
      const actual = result.facts.complete.workflowDefinitions
        .find((workflow) => workflow.path === `workflows/${id}.md`);
      check(actual?.introduction === source.purpose, `${id} introduction`);
      check(isDeepStrictEqual(actual?.sections.Preconditions.items, source.preconditions),
        `${id} Preconditions`);
      check(isDeepStrictEqual(actual?.sections.Steps.steps,
        source.steps.map((step, index) => `${step} -- ${source.stepAnnotations[index]}`)),
      `${id} Steps`);
      check(isDeepStrictEqual(actual?.sections["State Transitions"].rows, source.transitions),
        `${id} State Transitions`);
      check(isDeepStrictEqual(actual?.sections["Failure and Recovery"].items, source.failureRecovery),
        `${id} Failure and Recovery`);
    }
    const workflowHeadings = [
      "Preconditions", "Steps", "State Transitions", "Failure and Recovery"
    ];
    for (const id of ["state-none", "state-unknown", "state-unsupported"]) {
      const source = contexts.workflows?.[id];
      const workflowPath = `workflows/${id}.md`;
      const file = set.files.find((entry) => entry.path === workflowPath);
      const definition = result.facts.complete.workflowDefinitions
        .find((entry) => entry.path === workflowPath);
      const route = result.facts.complete.workflows.rows
        .find((entry) => entry.path === workflowPath);
      check(typeof source?.name === "string" && source.name.length > 0
        && route?.name === source.name, `${id} routing name`);
      check(typeof source?.purpose === "string" && source.purpose.length > 0
        && definition?.introduction === source.purpose, `${id} introduction`);
      check(isDeepStrictEqual(Object.keys(source?.sections ?? {}).sort(),
        [...workflowHeadings].sort()), `${id} sections`);
      const states = [];
      for (const heading of workflowHeadings) {
        const sectionSource = source?.sections?.[heading];
        let expected = null;
        if (sectionSource === "none") {
          states.push("none");
          expected = "none";
        } else if (sectionSource?.state === "unknown"
          && typeof sectionSource.requiredInput === "string"
          && sectionSource.requiredInput.length > 0) {
          states.push("unknown");
          expected = `unknown\n**unknown**: workflow ${heading} require the ${sectionSource.requiredInput}`;
        } else if (sectionSource?.state === "unsupported"
          && typeof sectionSource.feature === "string" && sectionSource.feature.length > 0) {
          states.push("unsupported");
          expected = `**unsupported**: replaces workflow ${heading}: ${sectionSource.feature} `
            + `at complete-contexts.json#/workflows/${id}/sections/${encodeURIComponent(heading)}`;
        }
        check(expected !== null && section(file?.content, `## ${heading}`) === expected,
          `${id} ${heading}`);
      }
      check(file?.metadata.coverage === (states.includes("unsupported")
        ? "requires-source" : "complete")
        && file?.metadata.knowledge === (states.includes("unknown")
          ? "requires-input" : "complete"), `${id} completeness`);
    }
    for (const entry of representations.representations.filter((item) => item.variants)) {
      const actual = fieldTables(operationBody(entry.operation));
      check(actual.length === entry.variants.length, `${entry.operation} variant count`);
      for (const [index, variant] of entry.variants.entries()) {
        check(isDeepStrictEqual(actual[index], expectedVariantRows(entry, variant)),
          `${entry.operation} variant ${index} schema`);
      }
    }
    for (const entry of representations.representations.filter((item) => item.schema)) {
      check(entry.schema.additionalProperties === false
        && isDeepStrictEqual(fieldTables(operationBody(entry.operation))[0]?.[0],
          ["$", "object", "yes", "no", "Additional properties are forbidden."]),
      `${entry.operation} closed root`);
    }
  }
  return issues;
}
