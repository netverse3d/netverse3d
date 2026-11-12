export type HealthProbe = () => Promise<void>;

export const HEALTH_PROBES = Symbol('HEALTH_PROBES');
