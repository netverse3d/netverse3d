import Handlebars from 'handlebars';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';

const engine = Handlebars.create();
const BUILT_IN_HELPERS = new Set(['if', 'unless', 'each', 'with', 'lookup']);
const MISSING_VARIABLE_PATTERN = /^"([^"]+)" not defined in/;

type TemplateRenderFailure =
  typeof DeliveryReason.MISSING_VARIABLE | typeof DeliveryReason.TEMPLATE_INVALID;

export class TemplateRenderError extends Error {
  constructor(
    readonly reason: TemplateRenderFailure,
    message: string,
  ) {
    super(message);
  }
}

interface SyntaxNode {
  type: string;
  path?: { type?: string; original?: unknown };
  params?: SyntaxNode[];
  hash?: { pairs: { value: SyntaxNode }[] };
  program?: SyntaxNode | null;
  inverse?: SyntaxNode | null;
  body?: SyntaxNode[];
  escaped?: boolean;
}

function inspectExpression(node: SyntaxNode, allowRawOutput: boolean, problems: string[]): void {
  const callsSomething = (node.params?.length ?? 0) > 0 || (node.hash?.pairs.length ?? 0) > 0;
  const name = node.path?.type === 'PathExpression' ? String(node.path.original) : undefined;
  if (callsSomething && name !== undefined && !BUILT_IN_HELPERS.has(name)) {
    problems.push(`unknown helper "${name}"`);
  }
  for (const param of node.params ?? []) {
    collectProblems(param, allowRawOutput, problems);
  }
  for (const pair of node.hash?.pairs ?? []) {
    collectProblems(pair.value, allowRawOutput, problems);
  }
}

function collectProblems(node: SyntaxNode, allowRawOutput: boolean, problems: string[]): void {
  switch (node.type) {
    case 'PartialStatement':
    case 'PartialBlockStatement':
      problems.push('partials are not supported');
      return;
    case 'Decorator':
    case 'DecoratorBlock':
      problems.push('decorators are not supported');
      return;
    case 'MustacheStatement':
      if (node.escaped === false && !allowRawOutput) {
        problems.push('unescaped output is not allowed in an email body');
      }
      inspectExpression(node, allowRawOutput, problems);
      return;
    case 'BlockStatement':
      inspectExpression(node, allowRawOutput, problems);
      if (node.program) {
        collectProblems(node.program, allowRawOutput, problems);
      }
      if (node.inverse) {
        collectProblems(node.inverse, allowRawOutput, problems);
      }
      return;
    case 'SubExpression':
      inspectExpression(node, allowRawOutput, problems);
      return;
    case 'Program':
      for (const child of node.body ?? []) {
        collectProblems(child, allowRawOutput, problems);
      }
      return;
    default:
  }
}

export function findTemplateProblems(
  source: string,
  options: { allowRawOutput: boolean },
): string[] {
  let program: unknown;
  try {
    program = engine.parse(source);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const problems: string[] = [];
  collectProblems(program as SyntaxNode, options.allowRawOutput, problems);
  return problems;
}

function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== null).map(withoutNulls);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== null);
    return Object.fromEntries(entries.map(([key, item]) => [key, withoutNulls(item)]));
  }
  return value;
}

export function renderTemplate(
  source: string,
  context: Record<string, unknown>,
  options: { escapeHtml: boolean },
): string {
  try {
    const compiled = engine.compile(source, { strict: true, noEscape: !options.escapeHtml });
    return compiled(withoutNulls(context));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const missing = MISSING_VARIABLE_PATTERN.exec(message);
    if (missing) {
      throw new TemplateRenderError(
        DeliveryReason.MISSING_VARIABLE,
        `Missing template variable "${missing[1]}"`,
      );
    }
    throw new TemplateRenderError(
      DeliveryReason.TEMPLATE_INVALID,
      `Template could not be rendered: ${message}`,
    );
  }
}
