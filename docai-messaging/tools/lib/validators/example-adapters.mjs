export function findExampleAdapter(exampleAdapters, mediaType, fenceInfo) {
  if (!Array.isArray(exampleAdapters)) return null;
  const matches = exampleAdapters.filter((adapter) => (
    adapter?.adapterClass === "payload-wire"
      && adapter.target === mediaType
      && adapter.fenceInfo === fenceInfo
      && typeof adapter.decodeExample === "function"
  ));
  return matches.length === 1 ? matches[0] : null;
}
