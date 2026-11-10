export const CLIP_BLEND_SECONDS = 0.18;

export function blendClipWeights(
  weights: ReadonlyMap<string, number>,
  current: string,
  seconds: number,
): Map<string, number> {
  const elapsed = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const others = [...weights].filter(([name, weight]) => name !== current && weight > 0);
  const fading = others.reduce((sum, [, weight]) => sum + weight, 0);
  if (fading === 0) return new Map([[current, 1]]);
  const rising = Math.min((weights.get(current) ?? 0) + elapsed / CLIP_BLEND_SECONDS, 1);
  const next = new Map<string, number>([[current, rising]]);
  const scale = (1 - rising) / fading;
  for (const [name, weight] of others) {
    if (weight * scale > 0) next.set(name, weight * scale);
  }
  return next;
}
