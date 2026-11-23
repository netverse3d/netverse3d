'use client';

import { useDispatch, useSelector } from 'react-redux';
import { useEffect, useState } from 'react';
import {
  rentalConfirmationAccepted,
  rentalConfirmationCancelled,
  remainingSeconds,
  sessionNoticeCleared,
  useRequested,
} from '../state/shop-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import { formatSessionDuration } from './session-time.ts';
import styles from './seat-prompt.module.css';
import { vi } from './text/vi.ts';

export default function SeatPrompt() {
  const dispatch = useDispatch<AppDispatch>();
  const nearbySeat = useSelector((state: RootState) => state.shop.nearbySeat);
  const seating = useSelector((state: RootState) => state.shop.seating);
  const rentalConfirmation = useSelector((state: RootState) => state.shop.rentalConfirmation);
  const session = useSelector((state: RootState) => state.shop.session);
  const sessionNotice = useSelector((state: RootState) => state.shop.sessionNotice);
  const ready = useSelector((state: RootState) => state.shop.scene.ready);
  const seatReady = useSelector((state: RootState) => state.shop.scene.seatReady);
  const [now, setNow] = useState(Date.now);
  const seatId = seating.seated ?? nearbySeat;
  useEffect(() => {
    if (!session || seatReady) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [seatReady, session]);
  useEffect(() => {
    if (!sessionNotice) return;
    const timeout = window.setTimeout(() => dispatch(sessionNoticeCleared()), 3000);
    return () => window.clearTimeout(timeout);
  }, [dispatch, sessionNotice]);
  useEffect(() => {
    if (!rentalConfirmation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.target instanceof Element && event.target.closest('[data-rental-cancel]')) {
          dispatch(rentalConfirmationCancelled());
          return;
        }
        document.querySelector<HTMLFormElement>('[data-rental-confirmation] form')?.requestSubmit();
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dispatch(rentalConfirmationCancelled());
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, rentalConfirmation]);

  const notice = sessionNotice ? (
    <div className={styles.sessionNotice} role="status" aria-live="polite" data-session-notice>
      {sessionNotice === 'expired' ? vi.seat.expiredNotice : vi.seat.leftNotice}
    </div>
  ) : null;

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
          <form
            className={styles.actions}
            onSubmit={(event) => {
              event.preventDefault();
              dispatch(rentalConfirmationAccepted(rentalConfirmation));
            }}
          >
            <button
              type="button"
              className={styles.cancelButton}
              data-rental-cancel
              onClick={() => dispatch(rentalConfirmationCancelled())}
            >
              {vi.seat.cancel}
            </button>
            <button type="submit" className={styles.confirmButton} autoFocus>
              {vi.seat.rentConfirm}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (!ready || !seating.available || !seatId) return notice;
  const seated = seating.seated !== null;
  if (seated) {
    if (seatReady) return notice;
    return (
      <>
        {notice}
        <section
          className={styles.session}
          data-seat={seatId}
          data-seated="true"
          aria-label={vi.seat.sessionLabel}
        >
          <div className={styles.sessionDetails}>
            <span className={styles.sessionLabel}>{vi.seat.sessionLabel}</span>
            <time
              className={
                session && remainingSeconds(session.endsAt, now, session.offset) < 60
                  ? styles.timerWarning
                  : styles.timer
              }
              data-session-timer
              aria-live="polite"
            >
              {formatSessionDuration(
                session ? remainingSeconds(session.endsAt, now, session.offset) : 0,
              )}
            </time>
          </div>
          <button
            type="button"
            className={styles.endButton}
            onClick={() => dispatch(useRequested())}
          >
            {vi.seat.endSession}
          </button>
        </section>
      </>
    );
  }
  return (
    <>
      {notice}
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
    </>
  );
}
