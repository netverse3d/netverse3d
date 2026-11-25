'use client';

import { Button, IconButton, Panel, Text } from '@netverse/ui/react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { remainingSeconds, useRequested } from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import { formatSessionDuration } from './session-time.ts';
import { vi } from './text/vi.ts';
import styles from './seat-desktop.module.css';

export default function SeatDesktop() {
  const dispatch = useDispatch<AppDispatch>();
  const scene = useSelector((state: RootState) => state.shop.scene);
  const seated = useSelector((state: RootState) => state.shop.seating.seated);
  const session = useSelector((state: RootState) => state.shop.session);
  const [minimized, setMinimized] = useState(false);
  const [now, setNow] = useState(Date.now);
  const active = Boolean(scene.seatReady && session && seated === session.seatId);

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (!active) setMinimized(false);
  }, [active]);

  useEffect(() => {
    if (!active || minimized) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMinimized(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, minimized]);

  if (!active || !session) return null;

  const seconds = remainingSeconds(session.endsAt, now, session.offset);
  const machine = vi.seat.machine(session.seatId);
  if (minimized) {
    return (
      <Button
        className={styles.restore}
        surface="glass"
        tone="cyan"
        duo="magenta"
        onClick={() => setMinimized(false)}
        aria-label={vi.seat.restoreDesktop(machine)}
        data-desktop-restore
      >
        {vi.seat.restoreDesktop(machine)}
      </Button>
    );
  }

  return (
    <Panel
      className={styles.desktop}
      aria-label={vi.seat.desktopLabel(machine)}
      data-seat-desktop
      data-desktop-open="true"
      data-seat={session.seatId}
      shape="bevel-all"
      cut="md"
      tone="cyan"
      duo="magenta"
      title={machine}
      meta={
        <Text
          as="time"
          variant="value"
          tone={seconds < 60 ? 'warning' : 'info'}
          aria-live="polite"
          data-session-timer
        >
          {formatSessionDuration(seconds)}
        </Text>
      }
      action={
        <IconButton
          icon="minimize"
          label={vi.seat.minimizeDesktop}
          tone="neutral"
          surface="glass"
          onClick={() => setMinimized(true)}
          data-desktop-minimize
        />
      }
    >
      <div className={styles.tiles}>
        {[1, 2, 3].map((number) => (
          <Button key={number} surface="glass" tone="neutral" state="disabled" aria-disabled="true">
            {vi.seat.comingSoon}
          </Button>
        ))}
      </div>
      <Button
        surface="neon"
        tone="danger"
        onClick={() => dispatch(useRequested())}
        data-end-session
      >
        {vi.seat.endSession}
      </Button>
    </Panel>
  );
}
