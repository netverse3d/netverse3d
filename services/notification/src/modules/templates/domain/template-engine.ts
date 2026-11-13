import Handlebars from 'handlebars';
import { DeliveryReason } from '../../notifications/domain/delivery-reasons';
import { MAX_RENDERED_BODY_LENGTH } from '../../notifications/domain/limits';

export const MAX_LOOP_DEPTH = 3;
export const MAX_LOOP_ITERATIONS = 10_000;
const MAX_COMPILED_TEMPLATES = 200;
const LOOP_HELPER = 'each';

const engine = Handlebars.create();
const BUILT_IN_HELPERS = new Set(['if', 'unless', LOOP_HELPER, 'with', 'lookup']);
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

interface RenderBudget {
  iterationsLeft: number;
  maxLength: number;
}

function tooLong(maxLength: number): TemplateRenderError {
  return new TemplateRenderError(
    DeliveryReason.TEMPLATE_INVALID,
    `Rendered template is longer than ${maxLength} characters`,
  );
}

function sizeOf(items: unknown): number {
  if (Array.isArray(items)) {
    return items.length;
  }
  return items !== null && typeof items === 'object' ? Object.keys(items).length : 0;
}

const unboundedLoop = engine.helpers[LOOP_HELPER] as Handlebars.HelperDelegate;

engine.registerHelper(
  LOOP_HELPER,
  function boundedLoop(this: unknown, items: unknown, options?: Handlebars.HelperOptions) {
    const budget = (options?.data as { budget?: RenderBudget } | undefined)?.budget;
    if (!options || !budget) {
      return unboundedLoop.call(this, items, options as Handlebars.HelperOptions) as string;
    }
    budget.iterationsLeft -= sizeOf(items);
    if (budget.iterationsLeft < 0) {
      throw new TemplateRenderError(
        DeliveryReason.TEMPLATE_INVALID,
        `Template needs more than ${MAX_LOOP_ITERATIONS} loop iterations`,
      );
    }
    let produced = 0;
    const renderItem = options.fn;
    const counted: Handlebars.HelperOptions = {
      ...options,
      fn: (context, frame) => {
        const part = renderItem(context, frame);
        produced += part.length;
        if (produced > budget.maxLength) {
          throw tooLong(budget.maxLength);
        }
        return part;
      },
    };
    return unboundedLoop.call(this, items, counted) as string;
  },
);

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

interface Inspection {
  allowRawOutput: boolean;
  problems: string[];
}

function nameOf(node: SyntaxNode): string | undefined {
  return node.path?.type === 'PathExpression' ? String(node.path.original) : undefined;
}

function inspectExpression(node: SyntaxNode, inspection: Inspection, loopDepth: number): void {
  const callsSomething = (node.params?.length ?? 0) > 0 || (node.hash?.pairs.length ?? 0) > 0;
  const name = nameOf(node);
  if (callsSomething && name !== undefined && !BUILT_IN_HELPERS.has(name)) {
    inspection.problems.push(`unknown helper "${name}"`);
  }
  for (const param of node.params ?? []) {
    collectProblems(param, inspection, loopDepth);
  }
  for (const pair of node.hash?.pairs ?? []) {
    collectProblems(pair.value, inspection, loopDepth);
  }
}

function inspectBlock(node: SyntaxNode, inspection: Inspection, loopDepth: number): void {
  const depth = nameOf(node) === LOOP_HELPER ? loopDepth + 1 : loopDepth;
  if (depth > MAX_LOOP_DEPTH) {
    inspection.problems.push(`loops must not be nested deeper than ${MAX_LOOP_DEPTH}`);
    return;
  }
  inspectExpression(node, inspection, loopDepth);
  if (node.program) {
    collectProblems(node.program, inspection, depth);
  }
  if (node.inverse) {
    collectProblems(node.inverse, inspection, depth);
  }
}

function collectProblems(node: SyntaxNode, inspection: Inspection, loopDepth: number): void {
  switch (node.type) {
    case 'PartialStatement':
    case 'PartialBlockStatement':
      inspection.problems.push('partials are not supported');
      return;
    case 'Decorator':
    case 'DecoratorBlock':
      inspection.problems.push('decorators are not supported');
      return;
    case 'MustacheStatement':
      if (node.escaped === false && !inspection.allowRawOutput) {
        inspection.problems.push('unescaped output is not allowed in an email body');
      }
      inspectExpression(node, inspection, loopDepth);
      return;
    case 'BlockStatement':
      inspectBlock(node, inspection, loopDepth);
      return;
    case 'SubExpression':
      inspectExpression(node, inspection, loopDepth);
      return;
    case 'Program':
      for (const child of node.body ?? []) {
        collectProblems(child, inspection, loopDepth);
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
  const inspection: Inspection = { allowRawOutput: options.allowRawOutput, problems: [] };
  collectProblems(program as SyntaxNode, inspection, 0);
  return inspection.problems;
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

const compiledTemplates = new Map<string, Handlebars.TemplateDelegate>();

function compiledTemplateOf(source: string, escapeHtml: boolean): Handlebars.TemplateDelegate {
  const key = `${escapeHtml ? 'escaped' : 'raw'}:${source}`;
  const known = compiledTemplates.get(key);
  const template = known ?? engine.compile(source, { strict: true, noEscape: !escapeHtml });
  compiledTemplates.delete(key);
  compiledTemplates.set(key, template);
  if (compiledTemplates.size > MAX_COMPILED_TEMPLATES) {
    for (const oldest of compiledTemplates.keys()) {
      compiledTemplates.delete(oldest);
      break;
    }
  }
  return template;
}

export function renderTemplate(
  source: string,
  context: Record<string, unknown>,
  options: { escapeHtml: boolean; maxLength?: number },
): string {
  const maxLength = options.maxLength ?? MAX_RENDERED_BODY_LENGTH;
  const budget: RenderBudget = { iterationsLeft: MAX_LOOP_ITERATIONS, maxLength };
  let rendered: string;
  try {
    rendered = compiledTemplateOf(source, options.escapeHtml)(withoutNulls(context), {
      data: { budget },
    });
  } catch (error) {
    if (error instanceof TemplateRenderError) {
      throw error;
    }
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
  if (rendered.length > maxLength) {
    throw tooLong(maxLength);
  }
  return rendered;
}
