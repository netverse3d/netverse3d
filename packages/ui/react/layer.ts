import { useCallback, useState } from 'react';

export function useLayerContainer() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const findContainer = useCallback((node: Element | null) => {
    setContainer(node?.closest('dialog') ?? null);
  }, []);
  return [findContainer, container ?? undefined] as const;
}
