'use client';

import { ToastStack } from '@netverse/ui/react';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  NOTICE_SPECS,
  nextExpiry,
  noticeActionChosen,
  noticeDismissed,
  noticesExpired,
  visibleNotices,
} from '../state/notice-slice.ts';
import type { AppDispatch, RootState } from '../state/store.ts';
import { vi } from './text/vi.ts';

export default function Notices() {
  const dispatch = useDispatch<AppDispatch>();
  const notices = useSelector((state: RootState) => state.notices);
  const expiry = nextExpiry(notices);
  const shown = visibleNotices(notices);

  useEffect(() => {
    if (expiry === null) return;
    const timeout = window.setTimeout(
      () => dispatch(noticesExpired(Date.now())),
      Math.max(0, expiry - Date.now()),
    );
    return () => window.clearTimeout(timeout);
  }, [dispatch, expiry]);

  return (
    <ToastStack
      label={vi.notices.label}
      closeLabel={vi.notices.close}
      onDismiss={(id) => dispatch(noticeDismissed(Number(id)))}
      items={shown.map((notice) => {
        const spec = NOTICE_SPECS[notice.kind];
        return {
          id: notice.id,
          name: notice.kind,
          tone: spec.tone,
          message: vi.notices.messages[notice.kind],
          action: spec.action && {
            label: vi.notices.actions[spec.action],
            onAction: () => dispatch(noticeActionChosen(notice.id)),
          },
        };
      })}
    />
  );
}
