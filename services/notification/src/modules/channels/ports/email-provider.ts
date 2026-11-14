import type { z } from 'zod';
import { ChannelSender } from './channel-sender';

export interface EmailSenderContext {
  fromAddress: string;
  fromName?: string;
  timeoutMs: number;
}

export interface EmailProvider {
  name: string;
  env: z.ZodRawShape;
  required: readonly string[];
  secrets: readonly string[];
  refine?(settings: Record<string, unknown>, context: z.RefinementCtx): void;
  create(settings: Record<string, unknown>, context: EmailSenderContext): ChannelSender;
}

const PLAIN_NAME = /^[\w .'-]+$/;

export function formatSender(context: EmailSenderContext, senderName?: string): string {
  const name = senderName ?? context.fromName;
  if (!name) {
    return context.fromAddress;
  }
  const display = PLAIN_NAME.test(name) ? name : `"${name.replace(/["\\]/g, '')}"`;
  return `${display} <${context.fromAddress}>`;
}
