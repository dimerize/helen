// Whole-page spatial travel is disabled. Links and history stay native until
// a replacement transition is reviewed and explicitly approved.
// Keep this inert export for callers holding the previous module contract.
export function createSpatialNavigation() {
  return {dispose() {}};
}
