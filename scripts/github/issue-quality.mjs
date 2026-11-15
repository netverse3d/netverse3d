import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { issueFieldInputs } from './backlog.mjs';
import { api, graphql, ORGANIZATION, REPOSITORY } from './gh.mjs';

const issueTypes = new Set(['Feature', 'Task', 'Bug']);
const priorityValues = new Set(['Urgent', 'High', 'Medium', 'Low']);
const effortValues = new Set(['High', 'Medium', 'Low']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function singleSelectError(fields, fieldName, allowedValues, required) {
  const value = text(fields[fieldName]);
  if (!value) return required ? `${fieldName} is required` : null;
  return allowedValues.has(value) ? null : `${fieldName} has unsupported value: ${value}`;
}

export function validateIssueMetadata(issue, { ready = false, allowedAreaLabels } = {}) {
  const errors = [];
  const type = text(issue.type);
  const labels = Array.isArray(issue.labels) ? issue.labels.map(text) : [];
  const areaLabels = labels.filter((label) => label.startsWith('area:') && label.length > 5);
  const milestone = text(issue.milestone);
  const fields = issue.fields && typeof issue.fields === 'object' ? issue.fields : {};

  if (!issueTypes.has(type))
    errors.push(type ? `Type has unsupported value: ${type}` : 'Type is required');
  if (areaLabels.length !== 1) errors.push('exactly one area:* label is required');
  else if (allowedAreaLabels && !allowedAreaLabels.has(areaLabels[0]))
    errors.push(`area label has unsupported value: ${areaLabels[0]}`);
  if (!milestone) errors.push('Milestone is required');

  const priorityError = singleSelectError(fields, 'Priority', priorityValues, true);
  if (priorityError) errors.push(priorityError);

  const effortError = singleSelectError(fields, 'Effort', effortValues, type !== 'Feature');
  if (effortError) errors.push(effortError);

  if (ready) {
    const assignees = Array.isArray(issue.assignees)
      ? issue.assignees.filter((assignee) => text(assignee)).length
      : 0;
    if (assignees === 0) errors.push('Assignees are required before Ready');
    if (!text(fields['Start date'])) errors.push('Start date is required before Ready');
    if (!text(fields['Target date'])) errors.push('Target date is required before Ready');
  }

  return errors;
}

function formValue(body, label) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(body ?? '').match(
    new RegExp(`(?:^|\\r?\\n)### ${escapedLabel}\\r?\\n+([^\\r\\n]*)`),
  );
  return text(match?.[1]);
}

export function parseIssueFormMetadata(body) {
  return {
    area: formValue(body, 'Khu vực'),
    milestone: formValue(body, 'Milestone'),
    priority: formValue(body, 'Priority'),
    effort: formValue(body, 'Effort'),
  };
}

function issueTypeName(type) {
  return typeof type === 'string' ? type : text(type?.name);
}

function issueLabelNames(labels) {
  return Array.isArray(labels)
    ? labels.map((label) => (typeof label === 'string' ? label : text(label?.name))).filter(Boolean)
    : [];
}

export function planIssueSync(issue, { areaLabels = [], milestones = [] } = {}) {
  const submitted = parseIssueFormMetadata(issue.body);
  const type = issueTypeName(issue.type);
  const labels = issueLabelNames(issue.labels);
  const desiredLabels = [...labels.filter((label) => !label.startsWith('area:')), submitted.area];
  const errors = validateIssueMetadata(
    {
      type,
      labels: submitted.area ? [submitted.area] : [],
      milestone: submitted.milestone,
      fields: { Priority: submitted.priority, Effort: submitted.effort },
    },
    { allowedAreaLabels: new Set(areaLabels) },
  );
  const milestone = milestones.find((item) => item.title === submitted.milestone);
  if (submitted.milestone && !milestone)
    errors.push(`Milestone has unsupported value: ${submitted.milestone}`);
  if (errors.length > 0) return { action: 'triage', errors };

  return {
    action: 'sync',
    type,
    labels: [...new Set(desiredLabels.filter((label) => label && label !== 'needs-triage'))],
    milestone: { number: milestone.number, title: milestone.title },
    fields: {
      priority: submitted.priority,
      ...(type !== 'Feature' && submitted.effort ? { effort: submitted.effort } : {}),
    },
  };
}

export async function applyIssueSyncPlan(issue, plan, { apiRequest, setFields }) {
  const currentLabels = issueLabelNames(issue.labels);
  const issuePath = `repos/${REPOSITORY}/issues/${issue.number}`;

  if (plan.action === 'triage') {
    if (!currentLabels.includes('needs-triage')) {
      await apiRequest('PATCH', issuePath, { labels: [...currentLabels, 'needs-triage'] });
    }
    return plan;
  }

  const patch = {};
  if (issueTypeName(issue.type) !== plan.type) patch.type = plan.type;
  if (issue.milestone?.number !== plan.milestone.number) patch.milestone = plan.milestone.number;
  if (
    currentLabels.length !== plan.labels.length ||
    currentLabels.some((label) => !plan.labels.includes(label)) ||
    plan.labels.some((label) => !currentLabels.includes(label))
  ) {
    patch.labels = plan.labels;
  }
  if (Object.keys(patch).length > 0) await apiRequest('PATCH', issuePath, patch);

  const fieldNames = { priority: 'Priority', effort: 'Effort' };
  const changedFields = Object.fromEntries(
    Object.entries(plan.fields).filter(
      ([name, value]) => issue.fields?.[fieldNames[name]] !== value,
    ),
  );
  if (Object.keys(changedFields).length > 0) await setFields(issue.node_id, changedFields);
  return plan;
}

const ISSUE_FIELD_QUERY = `query($organization: String!, $issueId: ID!) {
  organization(login: $organization) {
    issueFields(first: 50) {
      nodes {
        ... on IssueFieldSingleSelect { id name options { id name } }
        ... on IssueFieldDate { id name }
      }
    }
  }
  node(id: $issueId) {
    ... on Issue {
      issueFieldValues(first: 50) {
        nodes {
          ... on IssueFieldSingleSelectValue {
            name
            field { ... on IssueFieldSingleSelect { name } }
          }
        }
      }
    }
  }
}`;

const SET_ISSUE_FIELDS_MUTATION = `mutation($issueId: ID!, $issueFields: [IssueFieldCreateOrUpdateInput!]!) {
  setIssueFieldValue(input: { issueId: $issueId, issueFields: $issueFields }) {
    clientMutationId
  }
}`;

async function syncIssue(number) {
  const repositoryPath = `repos/${REPOSITORY}`;
  const issue = api('GET', `${repositoryPath}/issues/${number}`);
  const catalog = parse(readFileSync('docs/catalog.yaml', 'utf8'));
  const areaLabels = [
    ...catalog.components.map((component) => `area:${component.id}`),
    'area:docs',
    'area:infra',
  ];
  const milestones = api('GET', `${repositoryPath}/milestones?state=all&per_page=100`);
  const plan = planIssueSync(issue, { areaLabels, milestones });
  if (plan.action === 'triage') {
    await applyIssueSyncPlan(issue, plan, { apiRequest: api, setFields: async () => {} });
    console.log(`Marked #${number} needs-triage: ${plan.errors.join('; ')}`);
    return;
  }

  const metadata = graphql(ISSUE_FIELD_QUERY, {
    organization: ORGANIZATION,
    issueId: issue.node_id,
  });
  const fields = metadata.organization.issueFields.nodes;
  const fieldValues = Object.fromEntries(
    (metadata.node.issueFieldValues?.nodes ?? []).map((value) => [value.field.name, value.name]),
  );
  const issueWithFields = {
    ...issue,
    fields: {
      Priority: fieldValues.Priority,
      Effort: fieldValues.Effort,
    },
  };
  const setFields = async (nodeId, values) => {
    const issueFields = issueFieldInputs(fields, {
      priority: values.priority,
      effort: values.effort,
    });
    if (issueFields.length === 0) return;
    graphql(SET_ISSUE_FIELDS_MUTATION, { issueId: nodeId, issueFields });
  };
  await applyIssueSyncPlan(issueWithFields, plan, { apiRequest: api, setFields });
  console.log(`Synchronized metadata for #${number}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const flagIndex = process.argv.indexOf('--sync');
  const number = Number(process.argv[flagIndex + 1]);
  if (flagIndex === -1 || !Number.isInteger(number) || number < 1) {
    throw new Error('Usage: node scripts/github/issue-quality.mjs --sync <issue-number>');
  }
  await syncIssue(number);
}
