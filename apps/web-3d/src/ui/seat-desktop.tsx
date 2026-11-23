'use client';

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
      <button
        type="button"
        className={styles.restore}
        onClick={() => setMinimized(false)}
        aria-label={vi.seat.restoreDesktop(machine)}
        data-desktop-restore
      >
        {vi.seat.restoreDesktop(machine)}
      </button>
    );
  }

  return (
    <section
      className={styles.desktop}
      aria-label={vi.seat.desktopLabel(machine)}
      data-seat-desktop
      data-desktop-open="true"
      data-seat={session.seatId}
    >
      <header className={styles.header}>
        <h2 className={styles.machine}>{machine}</h2>
        <time
          className={seconds < 60 ? styles.timerWarning : styles.timer}
          aria-live="polite"
          data-session-timer
        >
          {formatSessionDuration(seconds)}
        </time>
        <button
          type="button"
          className={styles.minimize}
          onClick={() => setMinimized(true)}
          aria-label={vi.seat.minimizeDesktop}
          data-desktop-minimize
        >
          −
        </button>
      </header>
      <div className={styles.tiles}>
        {[1, 2, 3].map((number) => (
          <button key={number} type="button" className={styles.tile} aria-disabled="true" disabled>
            <span>{vi.seat.comingSoon}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className={styles.end}
        onClick={() => dispatch(useRequested())}
        data-end-session
      >
        {vi.seat.endSession}
      </button>
    </section>
  );
}
