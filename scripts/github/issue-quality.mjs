import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse } from 'yaml';
import { issueFieldInputs } from './backlog.mjs';
import { api, graphql, listIssues, ORGANIZATION, REPOSITORY } from './gh.mjs';

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

export function validateIssueMetadata(
  issue,
  { ready = false, allowedAreaLabels, allowedMilestones } = {},
) {
  const errors = [];
  const type = text(typeof issue.type === 'string' ? issue.type : issue.type?.name);
  const labels = Array.isArray(issue.labels)
    ? issue.labels.map((label) => text(typeof label === 'string' ? label : label?.name))
    : [];
  const areaLabels = labels.filter((label) => label.startsWith('area:') && label.length > 5);
  const milestone = text(
    typeof issue.milestone === 'string' ? issue.milestone : issue.milestone?.title,
  );
  const fields = issue.fields && typeof issue.fields === 'object' ? issue.fields : {};

  if (!issueTypes.has(type))
    errors.push(type ? `Type has unsupported value: ${type}` : 'Type is required');
  if (areaLabels.length !== 1) errors.push('exactly one area:* label is required');
  else if (allowedAreaLabels && !allowedAreaLabels.has(areaLabels[0]))
    errors.push(`area label has unsupported value: ${areaLabels[0]}`);
  if (!milestone) errors.push('Milestone is required');
  else if (allowedMilestones && !allowedMilestones.has(milestone))
    errors.push(`Milestone has unsupported value: ${milestone}`);

  const priorityError = singleSelectError(fields, 'Priority', priorityValues, true);
  if (priorityError) errors.push(priorityError);

  const effortError = singleSelectError(fields, 'Effort', effortValues, type !== 'Feature');
  if (effortError) errors.push(effortError);

  if (ready) {
    const assignees = Array.isArray(issue.assignees)
      ? issue.assignees.filter((assignee) =>
          text(typeof assignee === 'string' ? assignee : assignee?.login),
        ).length
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
          ... on IssueFieldDateValue {
            value
            field { ... on IssueFieldDate { name } }
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

export function loadIssueFieldData(issueId) {
  const metadata = graphql(ISSUE_FIELD_QUERY, { organization: ORGANIZATION, issueId });
  const values = Object.fromEntries(
    (metadata.node.issueFieldValues?.nodes ?? [])
      .filter((value) => value.field?.name)
      .map((value) => [value.field.name, value.name ?? value.value]),
  );
  return { fields: metadata.organization.issueFields.nodes, values };
}

export function parseIssueFieldValues(values) {
  return Object.fromEntries(
    values
      .map((field) => [
        field.issue_field_name,
        field.data_type === 'single_select' ? field.single_select_option?.name : field.value,
      ])
      .filter(([name, value]) => name && value !== undefined && value !== null),
  );
}

export function planIssueAudit(issues, { areaLabels = [], milestones = [] } = {}) {
  const areas = new Set(areaLabels);
  const milestoneTitles = new Set(milestones);
  const audited = issues.map((issue) => {
    const errors = validateIssueMetadata(issue, {
      allowedAreaLabels: areas,
      allowedMilestones: milestoneTitles,
    });
    const labels = issueLabelNames(issue.labels);
    return {
      number: issue.number,
      errors,
      hasTriage: labels.includes('needs-triage'),
      labels,
    };
  });
  const changes = audited.flatMap((issue) => {
    if (issue.errors.length > 0 && !issue.hasTriage) {
      return [
        {
          number: issue.number,
          action: 'add',
          labels: [...issue.labels, 'needs-triage'],
        },
      ];
    }
    if (issue.errors.length === 0 && issue.hasTriage) {
      return [
        {
          number: issue.number,
          action: 'remove',
          labels: issue.labels.filter((label) => label !== 'needs-triage'),
        },
      ];
    }
    return [];
  });
  return { issues: audited, changes };
}

export async function runIssueAudit(
  issues,
  { apply = false, areaLabels = [], milestones = [], apiRequest = api, onPreview = () => {} } = {},
) {
  const report = planIssueAudit(issues, { areaLabels, milestones });
  onPreview(report);
  if (apply) {
    for (const change of report.changes) {
      await apiRequest('PATCH', `repos/${REPOSITORY}/issues/${change.number}`, {
        labels: change.labels,
      });
    }
  }
  return report;
}

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

  const metadata = loadIssueFieldData(issue.node_id);
  const issueWithFields = { ...issue, fields: metadata.values };
  const setFields = async (nodeId, values) => {
    const issueFields = issueFieldInputs(metadata.fields, {
      priority: values.priority,
      effort: values.effort,
    });
    if (issueFields.length === 0) return;
    graphql(SET_ISSUE_FIELDS_MUTATION, { issueId: nodeId, issueFields });
  };
  await applyIssueSyncPlan(issueWithFields, plan, { apiRequest: api, setFields });
  console.log(`Synchronized metadata for #${number}`);
}

function printAudit(report, apply) {
  for (const issue of report.issues) {
    if (issue.errors.length > 0) {
      console.log(`#${issue.number}: ${issue.errors.join('; ')}`);
    }
  }
  for (const change of report.changes) {
    console.log(
      `Preview #${change.number}: ${change.action === 'add' ? 'add' : 'remove'} needs-triage`,
    );
  }
  const invalid = report.issues.filter((issue) => issue.errors.length > 0).length;
  const result = apply
    ? 'apply enabled; changes follow this preview'
    : 'read-only; no changes applied';
  console.log(
    `Audit: ${report.issues.length} open issues, ${invalid} with missing metadata, ${report.changes.length} label updates; ${result}.`,
  );
}

async function auditOpenIssues(apply) {
  const catalog = parse(readFileSync('docs/catalog.yaml', 'utf8'));
  const areaLabels = [
    ...catalog.components.map((component) => `area:${component.id}`),
    'area:docs',
    'area:infra',
  ];
  const milestones = parse(
    readFileSync('docs/requirements/milestones.yaml', 'utf8'),
  ).milestones.map((milestone) => milestone.title);
  const issues = listIssues('open').map((issue) => ({
    ...issue,
    fields: parseIssueFieldValues(
      api('GET', `repos/${REPOSITORY}/issues/${issue.number}/issue-field-values`),
    ),
  }));
  const report = await runIssueAudit(issues, {
    apply,
    areaLabels,
    milestones,
    onPreview: (report) => printAudit(report, apply),
  });
  if (apply) console.log(`Applied ${report.changes.length} label updates.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--audit')) {
    await auditOpenIssues(process.argv.includes('--apply'));
  } else if (process.argv.includes('--apply')) {
    throw new Error('Usage: node scripts/github/issue-quality.mjs --audit [--apply]');
  } else if (process.argv.includes('--sync')) {
    const flagIndex = process.argv.indexOf('--sync');
    const number = Number(process.argv[flagIndex + 1]);
    if (!Number.isInteger(number) || number < 1) {
      throw new Error('Usage: node scripts/github/issue-quality.mjs --sync <issue-number>');
    }
    await syncIssue(number);
  } else {
    throw new Error(
      'Usage: node scripts/github/issue-quality.mjs --sync <issue-number> | --audit [--apply]',
    );
  }
}
