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

export function formatSender(context: EmailSenderContext): string {
  return context.fromName ? `${context.fromName} <${context.fromAddress}>` : context.fromAddress;
}
