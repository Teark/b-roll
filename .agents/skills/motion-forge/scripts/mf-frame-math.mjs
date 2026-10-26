/**
 * Engine-independent framing math. Screen rects use a top-left origin, y down.
 * 3D vectors are [x, y, z]; verticalFov is in radians.
 */

const requireFinite = (value, name) => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be requireFinite`);
  return value;
};
const requirePositive = (value, name) => {
  requireFinite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be > 0`);
  return value;
};

export function clampValue(value, min = 0, max = 1) {
  requireFinite(value, 'value');
  requireFinite(min, 'min');
  requireFinite(max, 'max');
  if (min > max) throw new RangeError('min must be <= max');
  return Math.max(min, Math.min(max, value));
}

export const easings = Object.freeze({
  linear: t => t,
  smoothstep: t => t * t * (3 - 2 * t),
  smootherstep: t => t * t * t * (t * (t * 6 - 15) + 10),
});

function toScreenRect(rect) {
  const { x, y, w, h } = rect;
  requireFinite(x, 'rect.x');
  requireFinite(y, 'rect.y');
  requirePositive(w, 'rect.w');
  requirePositive(h, 'rect.h');
  if (x < 0 || y < 0 || x + w > 1 + 1e-12 || y + h > 1 + 1e-12) {
    throw new RangeError('normalized rect must lie inside [0, 1] × [0, 1]');
  }
  return { x, y, w, h };
}

/**
 * Map actual source bounds into a normalized region of a pixel viewport.
 * Mapping: screenX = sourceX * scale + tx (likewise y).
 * `cover` permits cropping; the caller supplies the mask/scissor if needed.
 * `maxScale` is a hard cap and can prevent a cover result from filling its rect.
 */
export function fitTransform({
  bounds,
  viewport,
  rect = { x: 0, y: 0, w: 1, h: 1 },
  mode = 'contain',
  align = { x: 0.5, y: 0.5 },
  maxScale = Infinity,
}) {
  const b = { ...bounds };
  requireFinite(b.x, 'bounds.x');
  requireFinite(b.y, 'bounds.y');
  requirePositive(b.w, 'bounds.w');
  requirePositive(b.h, 'bounds.h');
  const v = { x: 0, y: 0, ...viewport };
  requireFinite(v.x, 'viewport.x');
  requireFinite(v.y, 'viewport.y');
  requirePositive(v.w, 'viewport.w');
  requirePositive(v.h, 'viewport.h');
  const r = toScreenRect(rect);
  if (mode !== 'contain' && mode !== 'cover') throw new RangeError('mode must be contain or cover');
  if (maxScale !== Infinity) requirePositive(maxScale, 'maxScale');
  if (clampValue(align.x) !== align.x || clampValue(align.y) !== align.y) {
    throw new RangeError('align.x/y must be in [0, 1]');
  }
  const target = { x: v.x + r.x * v.w, y: v.y + r.y * v.h, w: r.w * v.w, h: r.h * v.h };
  const naturalScale = Math[mode === 'contain' ? 'min' : 'max'](target.w / b.w, target.h / b.h);
  const scale = Math.min(naturalScale, maxScale);
  const tx = target.x + (target.w - b.w * scale) * align.x - b.x * scale;
  const ty = target.y + (target.h - b.h * scale) * align.y - b.y * scale;
  const mappedBounds = { x: b.x * scale + tx, y: b.y * scale + ty, w: b.w * scale, h: b.h * scale };
  return {
    scale, tx, ty, targetRect: target, mappedBounds,
    // The target region expressed back in source coordinates; not intersected with bounds.
    sourceWindow: { x: (target.x - tx) / scale, y: (target.y - ty) / scale, w: target.w / scale, h: target.h / scale },
    limitedByMaxScale: scale < naturalScale,
    coversTarget: mappedBounds.w >= target.w - 1e-10 && mappedBounds.h >= target.h - 1e-10,
  };
}

function normalizeRig(state) {
  requirePositive(state.scale, 'rig.scale');
  requireFinite(state.tx, 'rig.tx');
  requireFinite(state.ty, 'rig.ty');
  return { scale: state.scale, tx: state.tx, ty: state.ty };
}

/** Logarithmic scale interpolation gives a constant relative zoom rate for linear ease. */
export function blendRig(from, to, t, { ease = 'smoothstep' } = {}) {
  const a = normalizeRig(from), b = normalizeRig(to);
  const easing = typeof ease === 'function' ? ease : easings[ease];
  if (typeof easing !== 'function') throw new RangeError('unknown ease');
  const u = clampValue(easing(clampValue(t)));
  if (u === 0) return a;
  if (u === 1) return b;
  const lerp = (x, y) => x + (y - x) * u;
  return { scale: Math.exp(lerp(Math.log(a.scale), Math.log(b.scale))), tx: lerp(a.tx, b.tx), ty: lerp(a.ty, b.ty) };
}

/** Keys: [{time, scale, tx, ty, ease?}]. A key's ease controls the following interval. */
export function sampleRigAt(keys, time) {
  requireFinite(time, 'time');
  if (!Array.isArray(keys) || keys.length === 0) throw new RangeError('keys must be nonempty');
  keys.forEach((key, index) => {
    requireFinite(key.time, 'key.time');
    normalizeRig(key);
    if (index > 0 && key.time <= keys[index - 1].time) throw new RangeError('key times must strictly increase');
  });
  if (time <= keys[0].time) return normalizeRig(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    if (time <= keys[i].time) {
      const a = keys[i - 1], b = keys[i];
      return blendRig(a, b, (time - a.time) / (b.time - a.time), { ease: a.ease ?? 'smoothstep' });
    }
  }
  return normalizeRig(keys[keys.length - 1]);
}

const dotProduct = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const addVectors = (a, b) => a.map((v, i) => v + b[i]);
const subtractVectors = (a, b) => a.map((v, i) => v - b[i]);
const scaleVector = (a, k) => a.map(v => v * k);
const crossProduct = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function toVector3(value, name) {
  if (!Array.isArray(value) || value.length !== 3) throw new TypeError(`${name} must be [x, y, z]`);
  value.forEach(v => requireFinite(v, name));
  return [...value];
}
function buildCameraBasis(basis) {
  const normalized = {};
  for (const key of ['right', 'up', 'forward']) {
    const v = toVector3(basis[key], `basis.${key}`);
    normalized[key] = scaleVector(v, 1 / requirePositive(Math.hypot(...v), `basis.${key} length`));
  }
  const { right, up, forward } = normalized;
  if (Math.abs(dotProduct(right, up)) > 1e-7 || Math.abs(dotProduct(right, forward)) > 1e-7 || Math.abs(dotProduct(up, forward)) > 1e-7 || dotProduct(crossProduct(right, up), forward) > -1 + 1e-7) {
    throw new RangeError('camera basis must be orthogonal, with right × up = -forward');
  }
  return normalized;
}

/**
 * Exact perspective fit of selected points for a fixed camera orientation/FOV.
 * `forward` points from camera into the scene. The camera may dolly and pan.
 * Fits every selected point at its own depth; no bounding-sphere approximation.
 * Select local detail with fitIndices; other points may be cropped or behind near.
 * The rect reserves screen space but does not create a renderer clipping mask.
 */
export function solvePerspectiveCamera({
  points,
  fitIndices,
  basis = { right: [1, 0, 0], up: [0, 1, 0], forward: [0, 0, -1] },
  verticalFov,
  aspect,
  rect = { x: 0, y: 0, w: 1, h: 1 },
  anchor,
  near = 0.01,
  minDistance = near,
}) {
  if (!Array.isArray(points) || points.length === 0) throw new RangeError('points must be nonempty');
  const worldPoints = points.map((p, i) => toVector3(p, `points[${i}]`));
  const indices = fitIndices === undefined ? worldPoints.map((_, i) => i) : fitIndices;
  if (!Array.isArray(indices) || indices.length === 0 || indices.some(i => !Number.isInteger(i) || i < 0 || i >= worldPoints.length)) {
    throw new RangeError('fitIndices must be a nonempty array of valid point indices');
  }
  const selected = indices.map(i => worldPoints[i]);
  const axes = buildCameraBasis(basis);
  const { right, up, forward } = axes;
  requirePositive(verticalFov, 'verticalFov');
  if (verticalFov >= Math.PI) throw new RangeError('verticalFov must be < PI');
  requirePositive(aspect, 'aspect');
  requirePositive(near, 'near');
  requirePositive(minDistance, 'minDistance');
  const r = toScreenRect(rect);
  const origin = anchor === undefined
    ? [0, 1, 2].map(axis => {
      const values = selected.map(p => p[axis]);
      return (Math.min(...values) + Math.max(...values)) / 2;
    })
    : toVector3(anchor, 'anchor');
  const local = selected.map(p => {
    const relative = subtractVectors(p, origin);
    return [dotProduct(relative, right), dotProduct(relative, up), dotProduct(relative, forward)];
  });
  const tanY = Math.tan(verticalFov / 2), tanX = tanY * aspect;
  const left = 2 * r.x - 1, rightEdge = 2 * (r.x + r.w) - 1;
  const top = 1 - 2 * r.y, bottom = 1 - 2 * (r.y + r.h);

  // For each point: edgeLow*tan*(d+z) <= coordinate-pan <= edgeHigh*tan*(d+z).
  // All lower pan bounds share one slope in d; all upper bounds share another.
  // Their intersection therefore gives a closed-form minimum distance.
  const interval = (axis, low, high, tan) => {
    const lower = Math.max(...local.map(p => p[axis] - high * tan * p[2]));
    const upper = Math.min(...local.map(p => p[axis] - low * tan * p[2]));
    return { lower, upper, low, high, tan, distance: (lower - upper) / ((high - low) * tan) };
  };
  const horizontal = interval(0, left, rightEdge, tanX);
  const vertical = interval(1, bottom, top, tanY);
  const distance = Math.max(minDistance, near - Math.min(...local.map(p => p[2])), horizontal.distance, vertical.distance);
  const midpoint = axis => ((axis.lower - axis.high * axis.tan * distance) + (axis.upper - axis.low * axis.tan * distance)) / 2;
  const lateralShift = { x: midpoint(horizontal), y: midpoint(vertical) };
  const target = addVectors(origin, addVectors(scaleVector(right, lateralShift.x), scaleVector(up, lateralShift.y)));
  const position = subtractVectors(target, scaleVector(forward, distance));
  const projected = local.map(([x, y, z]) => ({
    x: ((x - lateralShift.x) / ((distance + z) * tanX) + 1) / 2,
    y: (1 - (y - lateralShift.y) / ((distance + z) * tanY)) / 2,
    depth: distance + z,
  }));
  const minX = Math.min(...projected.map(p => p.x)), maxX = Math.max(...projected.map(p => p.x));
  const minY = Math.min(...projected.map(p => p.y)), maxY = Math.max(...projected.map(p => p.y));
  return {
    position, target, up: [...up], basis: axes, anchor: origin,
    distance, lateralShift, fittedIndices: [...indices],
    projectedRect: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    depthRange: { near: Math.min(...projected.map(p => p.depth)), far: Math.max(...projected.map(p => p.depth)) },
  };
}
