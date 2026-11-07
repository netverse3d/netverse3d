import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

export const REQUIREMENT_STATUSES = ['draft', 'accepted', 'implemented', 'deprecated'];
export const REQUIREMENT_PRIORITIES = ['must', 'should', 'could'];
export const DECISION_STATUSES = ['proposed', 'accepted', 'superseded'];

const REQUIREMENT_ID = /^REQ-\d{3}$/;
const REFERENCE = /\b(?:REQ-\d{3}|ADR-\d{4})\b/g;
const ISSUE_REFERENCE = /(?:^|\s)(?:closes|fixes|resolves|refs)\s+#\d+/i;
const PRODUCT_PATH = /^(?:apps|services|workers|packages|infra)\//;
const NON_PRODUCT_FILE = /(?:^|\/)(?:README\.md|component\.yaml)$/;

export function loadRegistry(root) {
  const text = readFileSync(join(root, 'docs/requirements/registry.yaml'), 'utf8');
  return parse(text)?.requirements ?? [];
}

export function validateRegistry(requirements) {
  const errors = [];
  const seen = new Set();
  for (const requirement of requirements) {
    const label = requirement.id ?? '(missing id)';
    if (!REQUIREMENT_ID.test(requirement.id ?? '')) errors.push(`${label}: invalid id`);
    if (seen.has(requirement.id)) errors.push(`${label}: duplicate id`);
    seen.add(requirement.id);
    if (!requirement.title) errors.push(`${label}: missing title`);
    if (!REQUIREMENT_STATUSES.includes(requirement.status)) {
      errors.push(`${label}: invalid status "${requirement.status}"`);
    }
    if (!REQUIREMENT_PRIORITIES.includes(requirement.priority)) {
      errors.push(`${label}: invalid priority "${requirement.priority}"`);
    }
    if (!requirement.milestone) errors.push(`${label}: missing milestone`);
    if (!requirement.area) errors.push(`${label}: missing area`);
    if (!Array.isArray(requirement.sources) || requirement.sources.length === 0) {
      errors.push(`${label}: missing sources`);
    }
  }
  return errors;
}

export function parseDecisionStatus(text) {
  const match = text.match(/^-\s*(?:\*\*)?Trạng thái(?:\*\*)?:\s*(?:\*\*)?([a-z]+)/im);
  return match ? match[1].toLowerCase() : null;
}

export function loadDecisions(root) {
  let names;
  try {
    names = readdirSync(join(root, 'docs/decisions'));
  } catch {
    return [];
  }
  return names
    .filter((name) => /^ADR-\d{4}-.+\.md$/.test(name))
    .map((name) => ({
      id: name.slice(0, 8),
      file: name,
      status: parseDecisionStatus(readFileSync(join(root, 'docs/decisions', name), 'utf8')),
    }));
}

export function validateDecisions(decisions) {
  const errors = [];
  for (const decision of decisions) {
    if (!DECISION_STATUSES.includes(decision.status)) {
      errors.push(`${decision.id}: invalid or missing status in ${decision.file}`);
    }
  }
  return errors;
}

export function extractReferences(text) {
  return [...new Set(text?.match(REFERENCE) ?? [])];
}

export function isProductPath(file) {
  return PRODUCT_PATH.test(file) && !NON_PRODUCT_FILE.test(file);
}

export function evaluateReferences(references, requirements, decisions) {
  const errors = [];
  const warnings = [];
  for (const reference of references) {
    if (reference.startsWith('REQ-')) {
      const requirement = requirements.find((item) => item.id === reference);
      if (!requirement) errors.push(`${reference} does not exist in the registry`);
      else if (requirement.status === 'deprecated') errors.push(`${reference} is deprecated`);
      else if (requirement.status === 'draft') {
        warnings.push(`${reference} is still draft; confirm it with the team`);
      }
    } else {
      const decision = decisions.find((item) => item.id === reference);
      if (!decision) errors.push(`${reference} does not exist in docs/decisions`);
      else if (decision.status === 'superseded') errors.push(`${reference} is superseded`);
    }
  }
  return { errors, warnings };
}

export function evaluatePullRequest({ body, files, requirements, decisions }) {
  const references = extractReferences(body);
  const { errors, warnings } = evaluateReferences(references, requirements, decisions);
  const productFiles = files.filter(isProductPath);
  if (productFiles.length > 0) {
    if (references.length === 0) {
      errors.push(
        `product files changed without a REQ or ADR reference: ${productFiles.slice(0, 5).join(', ')}`,
      );
    }
    if (!ISSUE_REFERENCE.test(body ?? '')) {
      errors.push('product files changed without an issue reference such as "Closes #12"');
    }
  }
  return { errors, warnings, references, productFiles };
}

export function evaluateBranchFlow({ base, head }) {
  if (base === 'main' && head !== 'staging' && !head.startsWith('hotfix/')) {
    return [`main only accepts pull requests from staging or hotfix/*, got "${head}"`];
  }
  if (base === 'staging' && head.startsWith('hotfix/')) {
    return ['hotfix branches target main; merge main back into staging afterwards'];
  }
  return [];
}
