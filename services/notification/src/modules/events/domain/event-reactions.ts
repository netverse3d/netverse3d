import { EventEnvelope, InvalidEventError, scopeKeyOf } from '@netverse/nest-kit';

export interface NotificationOrder {
  scope: string;
  eventType: string;
  recipient: { subject: string };
  variables: Record<string, unknown>;
}

type Reaction = (event: EventEnvelope) => NotificationOrder;

const WELCOME_EVENT_TYPE = 'account.welcome';

const REACTIONS: Readonly<Record<string, Readonly<Record<string, Reaction>>>> = {
  identity: {
    'user.email-verified': (event) => ({
      scope: scopeKeyOf(event),
      eventType: WELCOME_EVENT_TYPE,
      recipient: { subject: String(event.data.principalId) },
      variables: {},
    }),
  },
};

export function listenedSources(): string[] {
  return Object.keys(REACTIONS);
}

export function reactionTo(event: EventEnvelope): NotificationOrder | null {
  const reactions = Object.hasOwn(REACTIONS, event.source) ? REACTIONS[event.source] : undefined;
  const reaction =
    reactions && Object.hasOwn(reactions, event.type) ? reactions[event.type] : undefined;
  return reaction ? reaction(event) : null;
}

export function readEnvelope(payload: Buffer): EventEnvelope {
  let decoded: unknown;
  try {
    decoded = JSON.parse(payload.toString('utf8'));
  } catch {
    throw new InvalidEventError('event body is not valid JSON');
  }
  const isObject = decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded);
  if (!isObject || typeof (decoded as { source?: unknown }).source !== 'string') {
    throw new InvalidEventError('event body is not an event envelope with a source');
  }
  return decoded as EventEnvelope;
}
