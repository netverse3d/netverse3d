'use client';

import { useDispatch, useSelector } from 'react-redux';
import { seatRequested } from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import styles from './seat-prompt.module.css';
import { vi } from './text/vi.ts';

export default function SeatPrompt() {
  const dispatch = useDispatch<AppDispatch>();
  const seatId = useSelector((state: RootState) => state.shop.nearbySeat);
  const ready = useSelector((state: RootState) => state.shop.scene.ready);
  if (!seatId || !ready) return null;
  return (
    <div className={styles.prompt} data-seat={seatId}>
      <span className={styles.hint} aria-live="polite">
        <kbd className={styles.key}>{vi.seat.key}</kbd>
        {vi.seat.prompt}
      </span>
      <button
        type="button"
        className={styles.button}
        onClick={() => dispatch(seatRequested(seatId))}
      >
        {vi.seat.sit}
      </button>
    </div>
  );
}
