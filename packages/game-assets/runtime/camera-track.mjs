export const DEFAULT_SHOP_VIEWPOINTS = {
  'tim-neon': [
    {
      position: [4.8, 3.2, 4.5],
      target: [-0.5, 1.1, -0.6],
      label: 'Toàn cảnh diorama',
    },
    {
      position: [1.8, 1.45, 1.6],
      target: [-1.2, 1.05, -0.9],
      label: 'Dãy máy trạm và màn hình',
    },
    {
      position: [3.2, 1.75, -0.5],
      target: [-1.8, 0.95, -0.8],
      label: 'Góc nhìn từ cửa đón',
    },
  ],
  'bien-sau': [
    {
      position: [4.2, 3.0, 4.0],
      target: [-0.4, 1.0, -0.2],
      label: 'Toàn cảnh Biển Sâu',
    },
    {
      position: [1.5, 1.4, 2.2],
      target: [-0.8, 0.95, -0.6],
      label: 'Dàn máy Biển Sâu',
    },
    {
      position: [2.8, 2.0, -0.8],
      target: [-1.4, 0.9, -0.4],
      label: 'Góc hông Biển Sâu',
    },
  ],
  'cam-retro': [
    {
      position: [4.5, 2.9, 4.2],
      target: [-0.3, 1.0, -0.5],
      label: 'Toàn cảnh Cam Retro',
    },
    {
      position: [1.6, 1.35, 1.8],
      target: [-1.0, 0.95, -0.8],
      label: 'Dàn máy Cam Retro',
    },
    {
      position: [3.0, 1.8, -0.4],
      target: [-1.5, 1.0, -0.7],
      label: 'Góc cửa Cam Retro',
    },
  ],
};

export function getShopViewpoints(recipeId = 'tim-neon') {
  return DEFAULT_SHOP_VIEWPOINTS[recipeId] ?? DEFAULT_SHOP_VIEWPOINTS['tim-neon'];
}

export function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return [
    0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
    0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
    0.5 *
      (2 * p1[2] +
        (-p0[2] + p2[2]) * t +
        (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 +
        (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3),
  ];
}

export function catmullRomDerivative(p0, p1, p2, p3, t) {
  const t2 = t * t;
  return [
    0.5 *
      (-p0[0] +
        p2[0] +
        2 * (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t +
        3 * (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t2),
    0.5 *
      (-p0[1] +
        p2[1] +
        2 * (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t +
        3 * (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t2),
    0.5 *
      (-p0[2] +
        p2[2] +
        2 * (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t +
        3 * (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t2),
  ];
}

export function normalizeVector([x, y, z]) {
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

function parseViewpoint(item) {
  if (Array.isArray(item)) {
    return {
      position: [item[0], item[1], item[2]],
      target: null,
      label: null,
    };
  }
  return {
    position: [item.position[0], item.position[1], item.position[2]],
    target: item.target ? [item.target[0], item.target[1], item.target[2]] : null,
    label: item.label ?? null,
  };
}

export function createCameraTrack(viewpointsInput, options = {}) {
  if (!Array.isArray(viewpointsInput) || viewpointsInput.length < 2) {
    throw new RangeError('camera track requires at least 2 viewpoints');
  }

  const duration = options.duration ?? 18;
  if (!(duration > 0)) throw new RangeError('track duration must be positive');
  const loop = options.loop ?? true;

  const viewpoints = viewpointsInput.map(parseViewpoint);
  const n = viewpoints.length;
  const hasTargets = viewpoints.some((vp) => vp.target !== null);

  function getControlPoints(points, i, isLoop) {
    if (isLoop) {
      return [points[(i - 1 + n) % n], points[i], points[(i + 1) % n], points[(i + 2) % n]];
    }
    return [
      points[Math.max(0, i - 1)],
      points[i],
      points[Math.min(n - 1, i + 1)],
      points[Math.min(n - 1, i + 2)],
    ];
  }

  const positions = viewpoints.map((vp) => vp.position);
  const targets = hasTargets
    ? viewpoints.map((vp, index) => {
        if (vp.target) return vp.target;
        const next = viewpoints[(index + 1) % n].position;
        const curr = vp.position;
        const dir = normalizeVector([next[0] - curr[0], next[1] - curr[1], next[2] - curr[2]]);
        return [curr[0] + dir[0] * 2, curr[1] + dir[1] * 2, curr[2] + dir[2] * 2];
      })
    : null;

  function sampleAt(progress) {
    const clampedProgress = loop ? ((progress % 1) + 1) % 1 : Math.min(1, Math.max(0, progress));

    const segmentCount = loop ? n : n - 1;
    let segIndex;
    let segFraction;

    if (clampedProgress >= 1) {
      segIndex = segmentCount - 1;
      segFraction = 1.0;
    } else {
      const scaled = clampedProgress * segmentCount;
      segIndex = Math.floor(scaled);
      segFraction = scaled - segIndex;
    }

    const posControls = getControlPoints(positions, segIndex, loop);
    const pos = catmullRomPoint(
      posControls[0],
      posControls[1],
      posControls[2],
      posControls[3],
      segFraction,
    );
    const deriv = catmullRomDerivative(
      posControls[0],
      posControls[1],
      posControls[2],
      posControls[3],
      segFraction,
    );
    const tangent = normalizeVector(deriv);

    let target;
    if (targets) {
      const targetControls = getControlPoints(targets, segIndex, loop);
      target = catmullRomPoint(
        targetControls[0],
        targetControls[1],
        targetControls[2],
        targetControls[3],
        segFraction,
      );
    } else {
      target = [pos[0] + tangent[0] * 2.0, pos[1] + tangent[1] * 2.0, pos[2] + tangent[2] * 2.0];
    }

    const toTarget = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]];
    const direction = normalizeVector(toTarget);
    const yaw = Math.atan2(direction[0], direction[2]);
    const pitch = Math.atan2(direction[1], Math.hypot(direction[0], direction[2]));

    return {
      position: pos,
      target,
      direction,
      tangent,
      yaw,
      pitch,
      progress: clampedProgress,
    };
  }

  function sample(time) {
    const progress = time / duration;
    const sampled = sampleAt(progress);
    return {
      ...sampled,
      time,
      done: !loop && time >= duration,
    };
  }

  function approximateLength(steps = 100) {
    let total = 0;
    let prev = sampleAt(0).position;
    for (let step = 1; step <= steps; step += 1) {
      const curr = sampleAt(step / steps).position;
      total += Math.hypot(curr[0] - prev[0], curr[1] - prev[1], curr[2] - prev[2]);
      prev = curr;
    }
    return total;
  }

  return {
    duration,
    loop,
    viewpoints,
    sample,
    sampleAt,
    approximateLength,
  };
}
