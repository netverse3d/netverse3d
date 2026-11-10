export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualityPreset {
  maxPixelRatio: number;
  bloom: boolean;
  shadows: boolean;
  environmentIntensity: number;
}

export interface DeviceProfile {
  hardwareConcurrency?: number;
  devicePixelRatio?: number;
  mobile?: boolean;
  renderer?: string;
}

export const QUALITY_LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: { maxPixelRatio: 1, bloom: false, shadows: false, environmentIntensity: 0.25 },
  medium: { maxPixelRatio: 1.5, bloom: true, shadows: false, environmentIntensity: 0.3 },
  high: { maxPixelRatio: 2, bloom: true, shadows: true, environmentIntensity: 0.3 },
};

const DISCRETE_GPU = /nvidia|geforce|radeon (rx|pro)|apple m\d|adreno 7|mali-g7|arc a\d/i;
const WEAK_GPU = /swiftshader|llvmpipe|software|\b(hd|uhd) graphics [0-9]{3}\b/i;

export function isQualityLevel(value: unknown): value is QualityLevel {
  return typeof value === 'string' && (QUALITY_LEVELS as readonly string[]).includes(value);
}

export function detectQuality({
  hardwareConcurrency = 4,
  devicePixelRatio = 1,
  mobile = false,
  renderer = '',
}: DeviceProfile): QualityLevel {
  if (mobile || hardwareConcurrency <= 2 || WEAK_GPU.test(renderer)) return 'low';
  if (DISCRETE_GPU.test(renderer) && hardwareConcurrency >= 8 && devicePixelRatio <= 3) {
    return 'high';
  }
  return 'medium';
}

export function pixelRatioFor(level: QualityLevel, devicePixelRatio: number): number {
  return Math.min(devicePixelRatio, QUALITY_PRESETS[level].maxPixelRatio);
}
