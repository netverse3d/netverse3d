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

export function validateIssueMetadata(issue, { ready = false } = {}) {
  const errors = [];
  const type = text(issue.type);
  const labels = Array.isArray(issue.labels) ? issue.labels.map(text) : [];
  const areaLabels = labels.filter((label) => label.startsWith('area:') && label.length > 5);
  const milestone = text(issue.milestone);
  const fields = issue.fields && typeof issue.fields === 'object' ? issue.fields : {};

  if (!issueTypes.has(type))
    errors.push(type ? `Type has unsupported value: ${type}` : 'Type is required');
  if (areaLabels.length !== 1) errors.push('exactly one area:* label is required');
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
