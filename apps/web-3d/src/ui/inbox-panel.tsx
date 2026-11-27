import {
  Alert,
  Badge,
  Button,
  Dialog,
  EmptyState,
  Heading,
  ListItem,
  Pagination,
  Skeleton,
  Text,
} from '@netverse/ui/react';
import { useEffect, useRef, useState } from 'react';
import type { InboxClient, InboxPage } from '../types/inbox.ts';
import { vi } from './text/vi.ts';
import styles from './inbox-panel.module.css';

const text = vi.inbox;
const REFRESH_MS = 30000;
const PLACEHOLDER_ROWS = ['first', 'second', 'third'] as const;
const dateFormat = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });

export default function InboxPanel({ client }: { client: InboxClient }) {
  const activeLoad = useRef<AbortController | null>(null);
  const writing = useRef(false);
  const [open, setOpen] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [page, setPage] = useState<InboxPage | null>(null);
  const [unread, setUnread] = useState<number | null>(null);
  const [failure, setFailure] = useState<'load' | 'write' | null>(null);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState(0);

  useEffect(() => {
    async function load() {
      if (document.visibilityState !== 'visible' || writing.current) return;
      activeLoad.current?.abort();
      const controller = new AbortController();
      activeLoad.current = controller;
      const { signal } = controller;
      try {
        const [count, latest] = await Promise.all([
          client.count(signal),
          open ? client.list(pageNumber, signal) : null,
        ]);
        if (signal.aborted) return;
        setUnread(count.count);
        if (latest) setPage(latest);
        setFailure((previous) => (previous === 'load' ? null : previous));
      } catch {
        if (!signal.aborted && open) setFailure('load');
      }
    }

    void load();
    const timer = setInterval(() => void load(), REFRESH_MS);
    document.addEventListener('visibilitychange', load);
    return () => {
      activeLoad.current?.abort();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [client, open, pageNumber, request]);

  async function mark(id?: string) {
    if (writing.current) return;
    writing.current = true;
    activeLoad.current?.abort();
    setSaving(true);
    setFailure(null);
    try {
      if (id) await client.markRead(id);
      else await client.markAllRead();
      setRequest((current) => current + 1);
    } catch {
      setFailure('write');
    } finally {
      writing.current = false;
      setSaving(false);
    }
  }

  const current = page?.page === pageNumber ? page : null;
  const hasUnread = unread !== null && unread > 0;

  return (
    <>
      <Button
        className={styles.toggle}
        surface="glass"
        tone="cyan"
        duo="magenta"
        aria-label={hasUnread ? text.withUnread(unread) : text.title}
        aria-haspopup="dialog"
        onClick={() => {
          setPageNumber(1);
          setFailure(null);
          setOpen(true);
        }}
      >
        {text.title}
        {hasUnread && (
          <Badge tone="magenta" aria-hidden="true">
            {unread > 99 ? '99+' : unread}
          </Badge>
        )}
      </Button>
      <Dialog
        open={open}
        size="lg"
        title={text.title}
        titleId="inbox-title"
        closeLabel={text.close}
        onClose={() => setOpen(false)}
      >
        <div className={styles.toolbar} aria-busy={saving}>
          <Text variant="meta" role="status">
            {unread !== null && text.unread(unread)}
          </Text>
          <Button
            size="sm"
            surface="glass"
            tone="neutral"
            state={!hasUnread || saving ? 'disabled' : 'idle'}
            onClick={() => void mark()}
          >
            {text.readAll}
          </Button>
        </div>
        {failure && (
          <div className={styles.feedback}>
            <Alert tone="error">{failure === 'load' ? text.loadError : text.markError}</Alert>
            <Button
              size="sm"
              surface="glass"
              tone="neutral"
              onClick={() => {
                setFailure(null);
                setRequest((value) => value + 1);
              }}
            >
              {text.retry}
            </Button>
          </div>
        )}
        {!current && !failure && (
          <>
            <Text variant="meta" role="status">
              {text.loading}
            </Text>
            <ul className={styles.list} aria-hidden="true">
              {PLACEHOLDER_ROWS.map((row) => (
                <ListItem key={row} state="read" className={styles.placeholder}>
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </ListItem>
              ))}
            </ul>
          </>
        )}
        {current &&
          (current.content.length === 0 ? (
            <EmptyState icon="mail" title={text.empty} message={text.emptyHint} />
          ) : (
            <ul className={styles.list}>
              {current.content.map((item) => (
                <ListItem
                  key={item.id}
                  state={item.readAt === null ? 'unread' : 'read'}
                  data-unread={item.readAt === null}
                >
                  <Heading level="3">{item.title}</Heading>
                  <Text className={styles.body}>{item.body}</Text>
                  <div className={styles.meta}>
                    <Text as="span" variant="meta">
                      <time dateTime={item.createdAt}>
                        {dateFormat.format(new Date(item.createdAt))}
                      </time>
                    </Text>
                    {item.readAt === null && (
                      <Button
                        size="sm"
                        surface="ghost"
                        tone="cyan"
                        state={saving ? 'disabled' : 'idle'}
                        onClick={() => void mark(item.id)}
                      >
                        {text.markRead}
                      </Button>
                    )}
                  </div>
                </ListItem>
              ))}
            </ul>
          ))}
        {current && current.totalPages > 1 && (
          <Pagination
            className={styles.pagination}
            page={pageNumber}
            totalPages={current.totalPages}
            onPageChange={setPageNumber}
            disabled={saving}
            label={text.pages}
            previousLabel={text.previous}
            nextLabel={text.next}
            pageLabel={text.page}
          />
        )}
      </Dialog>
    </>
  );
}
