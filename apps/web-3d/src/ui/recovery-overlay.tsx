'use client';

import { Overlay, Panel, Spinner, Text } from '@netverse/ui/react';
import { useSelector } from 'react-redux';
import type { RootState } from '../state/store.ts';
import { vi } from './text/vi.ts';
import styles from './recovery-overlay.module.css';

export default function RecoveryOverlay() {
  const lost = useSelector((state: RootState) => state.shop.scene.lost);
  if (!lost) return null;
  return (
    <Overlay className={styles.overlay} data-webgl-recovery>
      <Panel
        className={styles.panel}
        role="alert"
        shape="bevel-all"
        cut="md"
        tone="cyan"
        duo="magenta"
        surface="solid"
        title={vi.recovery.title}
        action={<Spinner />}
      >
        <Text variant="meta">{vi.recovery.body}</Text>
      </Panel>
    </Overlay>
  );
}
