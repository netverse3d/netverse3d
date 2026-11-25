import { ICON_PATHS } from '../src/icons.mjs';

export type IconName = keyof typeof ICON_PATHS;

export function Icon({ name }: { name: IconName }) {
  const segments = (ICON_PATHS[name] as string)
    .split(' M')
    .map((segment) => (segment.startsWith('M') ? segment : `M${segment}`));
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {segments.map((segment) => (
        <path key={segment} d={segment} />
      ))}
    </svg>
  );
}
