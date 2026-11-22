export function createJunctionPlan({
  arms,
  order = arms,
  green,
  yellow,
  allRed,
  offset = 0,
  crossings = [],
}) {
  if (
    !Array.isArray(arms) ||
    arms.length < 1 ||
    new Set(arms).size !== arms.length ||
    !Array.isArray(order) ||
    order.length !== arms.length ||
    new Set(order).size !== arms.length ||
    order.some((arm) => !arms.includes(arm)) ||
    ![green, yellow, allRed].every((value) => Number.isFinite(value) && value > 0) ||
    !Number.isFinite(offset)
  )
    throw new RangeError('invalid junction cycle');
  if (
    new Set(crossings.map((crossing) => crossing.id)).size !== crossings.length ||
    crossings.some(
      (crossing) =>
        !crossing.id ||
        !Array.isArray(crossing.conflictingArms) ||
        crossing.conflictingArms.length === 0 ||
        crossing.conflictingArms.some((arm) => !arms.includes(arm)),
    )
  )
    throw new RangeError('invalid junction crossing');
  return {
    arms: [...arms],
    order: [...order],
    green,
    yellow,
    allRed,
    offset,
    crossings: crossings.map((crossing) => ({
      ...crossing,
      conflictingArms: [...crossing.conflictingArms],
    })),
    duration: arms.length * (green + yellow + allRed),
  };
}

export function signalStateAt(plan, time) {
  if (!Number.isFinite(time)) throw new RangeError('signal time must be finite');
  const slotLength = plan.green + plan.yellow + plan.allRed;
  const cycleTime = (((time + plan.offset) % plan.duration) + plan.duration) % plan.duration;
  const slot = Math.floor(cycleTime / slotLength);
  const within = cycleTime - slot * slotLength;
  const activeArm = plan.order[slot];
  const arms = Object.fromEntries(
    plan.arms.map((arm) => {
      const orderIndex = plan.order.indexOf(arm);
      const toGreen =
        (((orderIndex * slotLength - cycleTime) % plan.duration) + plan.duration) % plan.duration;
      const vehicle =
        arm !== activeArm || within >= plan.green + plan.yellow
          ? 'red'
          : within < plan.green
            ? 'green'
            : 'yellow';
      const remaining =
        vehicle === 'green'
          ? plan.green - within
          : vehicle === 'yellow'
            ? plan.green + plan.yellow - within
            : toGreen || plan.duration;
      return [arm, { vehicle, pedestrian: 'stop', remaining }];
    }),
  );
  const crossings = Object.fromEntries(
    plan.crossings.map(({ id, conflictingArms }) => [
      id,
      conflictingArms.every((arm) => arms[arm].vehicle === 'red') ? 'go' : 'stop',
    ]),
  );
  for (const arm of plan.arms) {
    const crossing = plan.crossings.find((item) => item.id === arm);
    arms[arm].pedestrian = crossing
      ? crossings[arm]
      : plan.arms.every((other) => arms[other].vehicle === 'red')
        ? 'go'
        : 'stop';
  }
  return { arms, crossings };
}

export function canCross(plan, crossingId, time) {
  if (!plan.crossings.some((crossing) => crossing.id === crossingId))
    throw new RangeError(`unknown crossing ${crossingId}`);
  return signalStateAt(plan, time).crossings[crossingId] === 'go';
}
