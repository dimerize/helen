/**
 * Walkable routes across an image's raised pigment. No rendering dependencies.
 * Paths include the exact starting point; the final point is the requested point
 * unless raised pigment requires a nearby ground destination (within 1.6 units).
 * Heights are sampled anew for each route, so changing world scale is supported.
 */
export function createSurfaceNavigator({ bounds, heightAt, stepHeight = .29, cellSize = .22 }) {
  const { minX, maxX, minZ, maxZ } = bounds || {};
  if (![minX, maxX, minZ, maxZ, stepHeight, cellSize].every(Number.isFinite)
      || maxX <= minX || maxZ <= minZ || stepHeight < 0 || cellSize <= 0 || typeof heightAt !== 'function') {
    throw new TypeError('Navigation requires finite bounds, positive cell size and a height sampler.');
  }
  const columns = Math.ceil((maxX - minX) / cellSize) + 1;
  const rows = Math.ceil((maxZ - minZ) / cellSize) + 1;
  const count = columns * rows, dx = (maxX - minX) / (columns - 1), dz = (maxZ - minZ) / (rows - 1);
  const sampleDistance = Math.min(dx, dz) / 4, epsilon = 1e-7;
  const point = id => ({ x: minX + (id % columns) * dx, z: minZ + Math.floor(id / columns) * dz });
  const index = p => Math.round((p.z - minZ) / dz) * columns + Math.round((p.x - minX) / dx);
  const inside = p => p && Number.isFinite(p.x) && Number.isFinite(p.z)
    && p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ;
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const step = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= stepHeight + epsilon;

  function findPath(from, to) {
    if (!inside(from) || !inside(to)) return [];
    const start = { x: from.x, z: from.z }, target = { x: to.x, z: to.z };
    const startY = heightAt(start.x, start.z), targetY = heightAt(target.x, target.z);
    if (!Number.isFinite(startY) || !Number.isFinite(targetY)) return [];
    if (distance(start, target) < epsilon) return [start];

    // A per-query cache avoids stale relief after the scanner's scale transition.
    const heights = new Float64Array(count).fill(NaN), sampled = new Uint8Array(count);
    const edges = new Map();
    function height(id) {
      if (!sampled[id]) {
        const p = point(id);
        heights[id] = heightAt(p.x, p.z);
        sampled[id] = 1;
      }
      return heights[id];
    }
    function lineClear(a, b) {
      const samples = Math.max(1, Math.ceil(distance(a, b) / sampleDistance));
      let previous = heightAt(a.x, a.z);
      for (let i = 1; i <= samples; i++) {
        const t = i / samples, h = heightAt(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t);
        if (!step(previous, h)) return false;
        previous = h;
      }
      return true;
    }
    function cardinalEdge(a, b) {
      return step(height(a), height(b)) && lineClear(point(a), point(b));
    }
    function edgeClear(a, b) {
      const key = Math.min(a, b) * count + Math.max(a, b);
      if (edges.has(key)) return edges.get(key);
      let clear = cardinalEdge(a, b);
      const ax = a % columns, az = Math.floor(a / columns), bx = b % columns, bz = Math.floor(b / columns);
      if (clear && ax !== bx && az !== bz) {
        const cornerA = az * columns + bx, cornerB = bz * columns + ax;
        clear = cardinalEdge(a, cornerA) && cardinalEdge(cornerA, b)
          && cardinalEdge(a, cornerB) && cardinalEdge(cornerB, b);
      }
      edges.set(key, clear);
      return clear;
    }
    function nearby(p, radius) {
      const result = [];
      const x0 = Math.max(0, Math.floor((p.x - radius - minX) / dx));
      const x1 = Math.min(columns - 1, Math.ceil((p.x + radius - minX) / dx));
      const z0 = Math.max(0, Math.floor((p.z - radius - minZ) / dz));
      const z1 = Math.min(rows - 1, Math.ceil((p.z + radius - minZ) / dz));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const id = z * columns + x;
        if (distance(point(id), p) <= radius + epsilon && Number.isFinite(height(id))) result.push(id);
      }
      return result;
    }

    const startNodes = nearby(start, Math.max(dx, dz) * 1.6)
      .filter(id => step(startY, height(id)) && lineClear(start, point(id)));
    if (!startNodes.length) return [];
    const local = nearby(target, 1.6);
    const floor = Math.min(targetY, ...local.map(height));
    const raisedTarget = targetY > floor + stepHeight + epsilon && !step(startY, targetY);
    const goals = raisedTarget
      ? local.filter(id => height(id) <= floor + stepHeight + epsilon)
      : nearby(target, Math.max(dx, dz) * 1.6).filter(id => step(targetY, height(id)) && lineClear(point(id), target));
    if (!goals.length) return [];
    const goalSet = new Set(goals), goalPoints = goals.map(point);
    const costs = new Float64Array(count).fill(Infinity), previous = new Int32Array(count).fill(-1);
    const closed = new Uint8Array(count), estimates = new Float64Array(count).fill(NaN), queue = [];
    function heuristic(id) {
      if (Number.isNaN(estimates[id])) {
        const p = point(id);
        estimates[id] = Math.min(...goalPoints.map(g => distance(p, g)));
      }
      return estimates[id];
    }
    function push(id, cost) {
      const entry = { id, cost, score: cost + heuristic(id) };
      let i = queue.length;
      queue.push(entry);
      while (i > 0) {
        const parent = (i - 1) >> 1;
        if (queue[parent].score <= entry.score) break;
        queue[i] = queue[parent]; i = parent;
      }
      queue[i] = entry;
    }
    function pop() {
      const first = queue[0], last = queue.pop();
      if (queue.length) {
        let i = 0;
        while (i * 2 + 1 < queue.length) {
          let child = i * 2 + 1;
          if (child + 1 < queue.length && queue[child + 1].score < queue[child].score) child++;
          if (queue[child].score >= last.score) break;
          queue[i] = queue[child]; i = child;
        }
        queue[i] = last;
      }
      return first;
    }
    for (const id of startNodes) {
      costs[id] = distance(start, point(id));
      push(id, costs[id]);
    }
    let reached = -1;
    while (queue.length) {
      const entry = pop(), id = entry.id;
      if (closed[id] || entry.cost > costs[id]) continue;
      if (goalSet.has(id)) { reached = id; break; }
      closed[id] = 1;
      const x = id % columns, z = Math.floor(id / columns), a = point(id);
      for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
        if ((!ox && !oz) || x + ox < 0 || x + ox >= columns || z + oz < 0 || z + oz >= rows) continue;
        const next = (z + oz) * columns + x + ox;
        if (closed[next] || !edgeClear(id, next)) continue;
        const high = Math.max(0, (height(id) + height(next)) / 2 - floor);
        const cost = costs[id] + distance(a, point(next)) * (1 + high * .12) + Math.abs(height(id) - height(next)) * .08;
        if (cost + epsilon < costs[next]) {
          costs[next] = cost; previous[next] = id; push(next, cost);
        }
      }
    }
    if (reached < 0) return [];
    const route = [];
    for (let id = reached; id !== -1; id = previous[id]) route.push(point(id));
    route.reverse(); route.unshift(start);
    if (!raisedTarget) route.push(target);

    // A clear chord must also respect the same grid corners as the A* route.
    function shortcut(a, b) {
      if (!lineClear(a, b)) return false;
      const samples = Math.max(1, Math.ceil(distance(a, b) / sampleDistance));
      let last = index(a);
      for (let i = 1; i <= samples; i++) {
        const t = i / samples, id = index({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        if (id !== last && !edgeClear(last, id)) return false;
        last = id;
      }
      return true;
    }
    const result = [start];
    for (let i = 0; i < route.length - 1;) {
      let next = route.length - 1;
      while (next > i + 1 && !shortcut(route[i], route[next])) next--;
      if (distance(result.at(-1), route[next]) > epsilon) result.push(route[next]);
      i = next;
    }
    return result;
  }
  return { findPath };
}
