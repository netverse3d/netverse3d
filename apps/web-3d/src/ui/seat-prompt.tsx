'use client';

import { useDispatch, useSelector } from 'react-redux';
import { useRequested } from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import styles from './seat-prompt.module.css';
import { vi } from './text/vi.ts';

export default function SeatPrompt() {
  const dispatch = useDispatch<AppDispatch>();
  const nearbySeat = useSelector((state: RootState) => state.shop.nearbySeat);
  const seating = useSelector((state: RootState) => state.shop.seating);
  const ready = useSelector((state: RootState) => state.shop.scene.ready);
  const seatId = seating.seated ?? nearbySeat;
  if (!ready || !seating.available || !seatId) return null;
  const seated = seating.seated !== null;
  return (
    <div className={styles.prompt} data-seat={seatId} data-seated={String(seated)}>
      {!seated && seating.denied && (
        <span className={styles.denied} role="alert">
          {vi.seat.denied[seating.denied]}
        </span>
      )}
      <span className={styles.hint} aria-live="polite">
        <kbd className={styles.key}>{vi.seat.key}</kbd>
        {seated ? vi.seat.standPrompt : vi.seat.prompt}
      </span>
      <button type="button" className={styles.button} onClick={() => dispatch(useRequested())}>
        {seated ? vi.seat.stand : vi.seat.sit}
      </button>
    </div>
  );
}
