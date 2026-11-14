export const TEMPLATE_CATEGORIES = ['TRANSACTIONAL', 'OPTIONAL'] as const;
export type TemplateCategoryName = (typeof TEMPLATE_CATEGORIES)[number];
