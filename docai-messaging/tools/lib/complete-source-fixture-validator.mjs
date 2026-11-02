import { validateAdapterSourceExpectations, validateAdapterPublicationExpectations,
  validatePayloadMediaIdentityExpectations } from "./validators/core.mjs";
import { assertCorpusFacts, containedPath, objectKeys, readCorpusJson, requireValue,
  uniqueStrings } from "./complete-corpus-contract.mjs";

const evaluators = new Map([
  ["adapter", validateAdapterSourceExpectations],
  ["adapter-publication", validateAdapterPublicationExpectations],
  ["payload-media-identity", validatePayloadMediaIdentityExpectations]
]);
export function validateCompleteSourceFixture(root, entry) {
  const recipe = readCorpusJson(containedPath(root, entry.path));
  objectKeys(recipe, ["mode", "evaluator", "scenario", "assertions"], [], "source recipe");
  requireValue(recipe.mode === "source-scenario", "invalid source mode");
  requireValue(evaluators.has(recipe.evaluator), "unknown source evaluator");
  const scenario = recipe.scenario;
  const groups = recipe.evaluator === "adapter-publication"
    ? ["selectionCases", "publicationCases", "actorCases"] : ["cases"];
  objectKeys(scenario, ["docaiMessagingVersion", ...groups], [], "source scenario");
  requireValue(scenario.docaiMessagingVersion === "0.17.1", "source scenario version differs");
  requireValue(groups.every(key => Array.isArray(scenario[key])), "source cases must be arrays");
  const cases = groups.flatMap(key => scenario[key]);
  requireValue(cases.length > 0, "source cases must be nonempty");
  uniqueStrings(cases.map(item => item?.caseId), "source case IDs", { nonempty: true });
  requireValue(cases.every(item => ["schema", "payload-wire", "header-encoding", "protocol-binding"].includes(item.adapterClass)),
    "unknown source adapter class");
  for (const group of groups) {
    const key = recipe.evaluator === "adapter-publication"
      ? { selectionCases: "projectedSelection", publicationCases: "projectedPublication", actorCases: "projectedActors" }[group]
      : recipe.evaluator === "adapter" ? "projected" : "projectedIdentity";
    requireValue(scenario[group].every(item => Object.hasOwn(item, key) && item[key] !== null
      && typeof item[key] === "object" && !Array.isArray(item[key])), `source expectation ${key} must be an explicit object`);
  }
  requireValue(Array.isArray(recipe.assertions) && recipe.assertions.length > 0, "source recipe needs literal assertions");
  const result = evaluators.get(recipe.evaluator)(scenario, { file: entry.path });
  assertCorpusFacts(result.facts, recipe.assertions);
  return { ...result, mode: "source-scenario" };
}
