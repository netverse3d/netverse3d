'use client';

import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  rentalConfirmationAccepted,
  rentalConfirmationCancelled,
  useRequested,
} from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import styles from './seat-prompt.module.css';
import { vi } from './text/vi.ts';

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }
  return [Math.floor(totalSeconds / 60), seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export default function SeatPrompt() {
  const dispatch = useDispatch<AppDispatch>();
  const nearbySeat = useSelector((state: RootState) => state.shop.nearbySeat);
  const seating = useSelector((state: RootState) => state.shop.seating);
  const rentalConfirmation = useSelector((state: RootState) => state.shop.rentalConfirmation);
  const ready = useSelector((state: RootState) => state.shop.scene.ready);
  const [elapsed, setElapsed] = useState(0);
  const seatId = seating.seated ?? nearbySeat;
  const seatedAt = seating.seated;
  useEffect(() => {
    if (!seatedAt) {
      setElapsed(0);
      return;
    }
    const startedAt = Date.now();
    const update = () => setElapsed(Date.now() - startedAt);
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [seatedAt]);

  if (rentalConfirmation) {
    return (
      <div className={styles.dialogBackdrop}>
        <section
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rental-title"
          data-rental-confirmation
        >
          <p className={styles.eyebrow}>{vi.seat.rentPriceLabel}</p>
          <h2 className={styles.title} id="rental-title">
            {vi.seat.rentTitle}
          </h2>
          <p className={styles.message}>{vi.seat.rentMessage}</p>
          <strong className={styles.price}>{vi.seat.freePrice}</strong>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => dispatch(rentalConfirmationCancelled())}
            >
              {vi.seat.cancel}
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              onClick={() => dispatch(rentalConfirmationAccepted(rentalConfirmation))}
            >
              {vi.seat.rentConfirm}
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (!ready || !seating.available || !seatId) return null;
  const seated = seating.seated !== null;
  if (seated) {
    return (
      <section
        className={styles.session}
        data-seat={seatId}
        data-seated="true"
        aria-label={vi.seat.sessionLabel}
      >
        <div className={styles.sessionDetails}>
          <span className={styles.sessionLabel}>{vi.seat.sessionLabel}</span>
          <time className={styles.timer} data-session-timer>
            {formatDuration(elapsed)}
          </time>
        </div>
        <button type="button" className={styles.endButton} onClick={() => dispatch(useRequested())}>
          {vi.seat.endSession}
        </button>
      </section>
    );
  }
  return (
    <div className={styles.prompt} data-seat={seatId} data-seated={String(seated)}>
      {!seated && seating.denied?.seatId === seatId && (
        <span className={styles.denied} role="alert">
          {vi.seat.denied[seating.denied.reason]}
        </span>
      )}
      {seating.error && (
        <span className={styles.denied} role="alert">
          {vi.seat.roomError}
        </span>
      )}
      <span className={styles.hint} aria-live="polite">
        <kbd className={styles.key}>{vi.seat.key}</kbd>
        {vi.seat.prompt}
      </span>
      <button type="button" className={styles.button} onClick={() => dispatch(useRequested())}>
        {vi.seat.sit}
      </button>
    </div>
  );
}
