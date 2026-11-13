export const EVENT_TYPE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
export const LOCALE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;
export const BRAND_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

export const MAX_EVENT_TYPE_LENGTH = 128;
export const MAX_LOCALE_LENGTH = 16;
export const MAX_SUBJECT_ID_LENGTH = 255;
export const MAX_EMAIL_LENGTH = 320;
export const MAX_DEVICE_TOKEN_LENGTH = 512;
export const MAX_DEVICE_TOKENS = 100;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
export const MAX_TEMPLATE_SUBJECT_LENGTH = 1000;
export const MAX_TEMPLATE_BODY_LENGTH = 100_000;
export const MAX_BRAND_KEY_LENGTH = 64;
export const MAX_BRAND_VALUE_LENGTH = 4000;
export const MAX_BLOCKED_ADDRESS_LENGTH = 512;
export const MAX_BLOCK_REASON_LENGTH = 255;
export const MAX_DELIVERY_DETAIL_LENGTH = 1000;

export const ROLE_NOTIFICATION_SEND = 'notification:send';
