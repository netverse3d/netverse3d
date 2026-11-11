export interface ClipTrack {
  select(name: string): void;
  current(): string;
  takeRestart(name: string): boolean;
}

export function createClipTrack(
  clips: Iterable<string>,
  playedOnce: Iterable<string>,
  first: string,
): ClipTrack {
  const known = new Set(clips);
  const once = new Set(playedOnce);
  const restarts = new Set<string>();
  let clip = first;
  return {
    select(name) {
      if (!known.has(name) || name === clip) return;
      clip = name;
      if (once.has(name)) restarts.add(name);
    },
    current() {
      return clip;
    },
    takeRestart(name) {
      return restarts.delete(name);
    },
  };
}
