export const DELIVERY_CHANNELS = ['EMAIL', 'PUSH', 'IN_APP'] as const;

export type DeliveryChannelName = (typeof DELIVERY_CHANNELS)[number];

export const DELIVERY_STATUSES = ['PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'DEAD'] as const;

export type DeliveryStatusName = (typeof DELIVERY_STATUSES)[number];
