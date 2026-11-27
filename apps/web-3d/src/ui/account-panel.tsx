import { Alert, Button, Dialog, Text, TextField, TextLink } from '@netverse/ui/react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { vi } from './text/vi.ts';
import styles from './account-panel.module.css';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';
type Fields = { email: string; password: string; code: string; displayName: string };
type Actions = Record<Mode, (fields: Fields) => Promise<unknown>>;

type Props = {
  checking: boolean;
  account: { label: string } | null;
  sessionError: string | null;
  actions: Actions;
  resend: (email: string) => Promise<unknown>;
  logout: () => Promise<void>;
  children?: ReactNode;
};

const text = vi.account;
const nextMode: Record<Exclude<Mode, 'login'>, Mode> = {
  register: 'verify',
  verify: 'login',
  forgot: 'reset',
  reset: 'login',
};

function messageFor(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  return Object.hasOwn(text.errors, code)
    ? text.errors[code as keyof typeof text.errors]
    : text.errors['CLIENT.UNAVAILABLE'];
}

export default function AccountPanel({
  checking,
  account,
  sessionError,
  actions,
  resend,
  logout,
  children,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!open) return;
    formRef.current?.querySelector<HTMLInputElement>('[data-account-focus]')?.focus();
  }, [mode, open]);

  function changeMode(next: Mode, message = '') {
    const input = formRef.current?.querySelector<HTMLInputElement>('[name="email"]');
    if (input) setEmail(input.value.trim());
    setMode(next);
    setError('');
    setNotice(message);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const fields = {
      email: String(data.get('email') ?? '').trim(),
      password: String(data.get('password') ?? ''),
      code: String(data.get('code') ?? '').trim(),
      displayName: String(data.get('displayName') ?? '').trim(),
    };
    setEmail(fields.email);
    setPending(true);
    setError('');
    setNotice('');
    try {
      await actions[mode](fields);
      if (mode === 'login') setOpen(false);
      else changeMode(nextMode[mode], text.notices[mode]);
    } catch (reason) {
      if (
        mode === 'login' &&
        reason instanceof Error &&
        reason.message === 'IDENTITY.EMAIL_NOT_VERIFIED'
      ) {
        changeMode('verify');
      }
      setError(messageFor(reason));
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    if (pending) return;
    setPending(true);
    setError('');
    setNotice('');
    try {
      await resend(email);
      setNotice(text.notices.register);
    } catch (reason) {
      setError(messageFor(reason));
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setEmail('');
    setMode('login');
    setError('');
    setNotice('');
    setOpen(true);
    setPending(true);
    try {
      await logout();
    } catch {
      setError(text.logoutError);
    } finally {
      setPending(false);
    }
  }

  const needsCode = mode === 'verify' || mode === 'reset';
  const needsNewPassword = mode === 'register' || mode === 'reset';

  return (
    <>
      <div className={styles.accountBar} role="group" aria-label={text.accountLabel}>
        {account && (
          <Text as="span" variant="meta" className={styles.accountName}>
            {account.label}
          </Text>
        )}
        {account ? (
          <Button surface="glass" tone="cyan" duo="magenta" onClick={signOut}>
            {text.signOut}
          </Button>
        ) : (
          <Button
            surface="neon"
            tone="cyan"
            duo="magenta"
            aria-haspopup="dialog"
            state={checking ? 'pending' : 'idle'}
            onClick={() => {
              changeMode('login');
              if (sessionError) setError(messageFor(new Error(sessionError)));
              setOpen(true);
            }}
          >
            {checking ? text.checking : text.actions.login}
          </Button>
        )}
        {children}
      </div>
      <Dialog
        open={open}
        title={text.titles[mode]}
        titleId="account-title"
        titleLevel={1}
        closeLabel={text.close}
        busy={pending}
        onClose={() => setOpen(false)}
      >
        <form
          ref={formRef}
          key={mode}
          className={styles.form}
          onSubmit={submit}
          aria-busy={pending}
        >
          <TextField
            label={text.email}
            type="email"
            name="email"
            autoComplete="username"
            defaultValue={email}
            maxLength={320}
            required
            readOnly={needsCode || pending}
            data-account-focus={!needsCode || undefined}
          />
          {mode === 'register' && (
            <TextField
              label={text.displayName}
              name="displayName"
              autoComplete="nickname"
              maxLength={120}
              readOnly={pending}
            />
          )}
          {needsCode && (
            <TextField
              label={text.code}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              readOnly={pending}
              data-account-focus
            />
          )}
          {(mode === 'login' || needsNewPassword) && (
            <TextField
              label={needsNewPassword ? text.newPassword : text.password}
              message={needsNewPassword ? text.passwordHint : undefined}
              type="password"
              name="password"
              autoComplete={needsNewPassword ? 'new-password' : 'current-password'}
              minLength={needsNewPassword ? 8 : undefined}
              maxLength={72}
              required
              readOnly={pending}
            />
          )}
          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="info">{notice}</Alert>}
          <Button type="submit" size="lg" block state={pending ? 'pending' : 'idle'}>
            {pending ? text.processing : text.actions[mode]}
          </Button>
        </form>
        <div className={styles.links}>
          {mode === 'login' ? (
            <>
              <TextLink disabled={pending} onClick={() => changeMode('register')}>
                {text.actions.register}
              </TextLink>
              <TextLink disabled={pending} onClick={() => changeMode('forgot')}>
                {text.titles.forgot}
              </TextLink>
            </>
          ) : (
            <TextLink disabled={pending} onClick={() => changeMode('login')}>
              {text.backToLogin}
            </TextLink>
          )}
          {mode === 'verify' && (
            <TextLink disabled={pending} onClick={resendCode}>
              {text.resend}
            </TextLink>
          )}
          {mode === 'reset' && (
            <TextLink disabled={pending} onClick={() => changeMode('forgot')}>
              {text.resend}
            </TextLink>
          )}
        </div>
      </Dialog>
    </>
  );
}
