import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { validateIssueMetadata } from '../github/issue-quality.mjs';

export const REQUIREMENT_STATUSES = ['draft', 'accepted', 'implemented', 'deprecated'];
export const REQUIREMENT_PRIORITIES = ['must', 'should', 'could'];
export const DECISION_STATUSES = ['proposed', 'accepted', 'superseded'];

const REQUIREMENT_ID = /^REQ-\d{3}$/;
const REFERENCE = /\b(?:REQ-\d{3}|ADR-\d{4})\b/g;
const CLOSING_REFERENCE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b/gi;
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

export function extractClosingIssueNumbers(body) {
  return [
    ...new Set(
      [...String(body ?? '').matchAll(CLOSING_REFERENCE)].map((match) => Number(match[1])),
    ),
  ];
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
      else if (decision.status === 'proposed') {
        warnings.push(`${reference} is still proposed; confirm it with the team`);
      }
    }
  }
  return { errors, warnings };
}

export function isTraceExempt({ base, head, isFork = false }) {
  return !isFork && base === 'main' && head === 'staging';
}

function warnSelfAdded(references, prefix, knownIds, baseIds) {
  if (!baseIds) return [];
  return references
    .filter((id) => id.startsWith(prefix) && knownIds.includes(id) && !baseIds.includes(id))
    .map((id) => `${id} was added by this pull request; reviewers must confirm it`);
}

export function evaluatePullRequest({
  body,
  files,
  requirements,
  decisions,
  exempt = false,
  closingIssues = [],
  allowedAreaLabels,
  allowedMilestones,
  baseRequirementIds = null,
  baseDecisionIds = null,
}) {
  const references = extractReferences(body);
  const { errors, warnings } = evaluateReferences(references, requirements, decisions);
  warnings.push(
    ...warnSelfAdded(
      references,
      'REQ-',
      requirements.map((item) => item.id),
      baseRequirementIds,
    ),
    ...warnSelfAdded(
      references,
      'ADR-',
      decisions.map((item) => item.id),
      baseDecisionIds,
    ),
  );
  const productFiles = files.filter(isProductPath);
  if (productFiles.length > 0 && !exempt) {
    if (references.length === 0) {
      errors.push(
        `product files changed without a REQ or ADR reference: ${productFiles.slice(0, 5).join(', ')}`,
      );
    }
  }
  const closingIssueNumbers = extractClosingIssueNumbers(body);
  if (!exempt && closingIssueNumbers.length === 0) {
    errors.push('a pull request into staging must close an issue, for example "Closes #12"');
  }
  if (!exempt) {
    const issuesByNumber = new Map(closingIssues.map((issue) => [issue.number, issue]));
    for (const number of closingIssueNumbers) {
      const issue = issuesByNumber.get(number);
      if (!issue) {
        errors.push(`#${number}: issue metadata could not be loaded`);
        continue;
      }
      const labels = Array.isArray(issue.labels)
        ? issue.labels.map((label) => (typeof label === 'string' ? label : label.name))
        : [];
      if (labels.includes('needs-triage')) errors.push(`#${number}: issue is marked needs-triage`);
      const metadataErrors = validateIssueMetadata(issue, {
        ready: true,
        allowedAreaLabels: allowedAreaLabels ? new Set(allowedAreaLabels) : undefined,
        allowedMilestones: allowedMilestones ? new Set(allowedMilestones) : undefined,
      });
      for (const error of metadataErrors) errors.push(`#${number}: ${error}`);
    }
  }
  return { errors, warnings, references, productFiles };
}

export function evaluateBranchFlow({ base, head, isFork = false }) {
  if (base === 'main' && isFork) return ['main does not accept pull requests from forks'];
  if (base === 'main' && head !== 'staging') {
    return [`main only accepts pull requests from staging, got "${head}"`];
  }
  if (base === 'staging' && head === 'main') {
    return ['staging does not accept pull requests from main; changes flow from staging to main'];
  }
  return [];
}
