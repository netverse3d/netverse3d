'use client';

import {
  Alert,
  Badge,
  Button,
  Heading,
  KeyHint,
  Overlay,
  Panel,
  Text,
  Toast,
} from '@netverse/ui/react';
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
    <Toast className={styles.sessionNotice} aria-live="polite" data-session-notice>
      {sessionNotice === 'expired' ? vi.seat.expiredNotice : vi.seat.leftNotice}
    </Toast>
  ) : null;

  if (rentalConfirmation) {
    return (
      <Overlay className={styles.overlay}>
        <Panel
          className={styles.dialog}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rental-title"
          data-rental-confirmation
          shape="bevel-all"
          cut="lg"
          tone="primary"
          duo="magenta"
          surface="solid"
        >
          <Text variant="label" tone="info">
            {vi.seat.rentPriceLabel}
          </Text>
          <Heading id="rental-title">{vi.seat.rentTitle}</Heading>
          <Text variant="meta">{vi.seat.rentMessage}</Text>
          <div>
            <Badge tone="highlight">{vi.seat.freePrice}</Badge>
          </div>
          <form
            className={styles.actions}
            onSubmit={(event) => {
              event.preventDefault();
              dispatch(rentalConfirmationAccepted(rentalConfirmation));
            }}
          >
            <Button
              surface="glass"
              tone="neutral"
              data-rental-cancel
              onClick={() => dispatch(rentalConfirmationCancelled())}
            >
              {vi.seat.cancel}
            </Button>
            <Button type="submit" autoFocus>
              {vi.seat.rentConfirm}
            </Button>
          </form>
        </Panel>
      </Overlay>
    );
  }

  if (!ready || !seating.available || !seatId) return notice;
  const seated = seating.seated !== null;
  if (seated) {
    if (seatReady) return notice;
    const seconds = session ? remainingSeconds(session.endsAt, now, session.offset) : 0;
    return (
      <>
        {notice}
        <Panel
          className={styles.session}
          data-seat={seatId}
          data-seated="true"
          aria-label={vi.seat.sessionLabel}
          shape="notch"
          cut="sm"
          tone="cyan"
          duo="magenta"
        >
          <div className={styles.sessionDetails}>
            <Text as="span" variant="label">
              {vi.seat.sessionLabel}
            </Text>
            <Text
              as="time"
              variant="value"
              tone={seconds < 60 ? 'warning' : 'info'}
              className={styles.timer}
              data-session-timer
              aria-live="polite"
            >
              {formatSessionDuration(seconds)}
            </Text>
          </div>
          <Button surface="neon" tone="danger" onClick={() => dispatch(useRequested())}>
            {vi.seat.endSession}
          </Button>
        </Panel>
      </>
    );
  }
  return (
    <>
      {notice}
      <div className={styles.prompt} data-seat={seatId} data-seated={String(seated)}>
        {!seated && seating.denied?.seatId === seatId && (
          <Alert tone="warning">{vi.seat.denied[seating.denied.reason]}</Alert>
        )}
        {seating.error && <Alert tone="error">{vi.seat.roomError}</Alert>}
        <KeyHint className={styles.hint} keyLabel={vi.seat.key} aria-live="polite">
          {vi.seat.prompt}
        </KeyHint>
        <Button className={styles.button} onClick={() => dispatch(useRequested())}>
          {vi.seat.sit}
        </Button>
      </div>
    </>
  );
}
