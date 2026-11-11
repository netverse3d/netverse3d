const PRIORITY = { must: 'High', should: 'Medium', could: 'Low' };
const EFFORT = { XS: 'Low', S: 'Low', M: 'Medium', L: 'High', XL: 'High' };
const READY_REQUIREMENT_STATUSES = ['accepted', 'implemented'];
const REFINE_BEFORE_READY = 'Người nhận bổ sung mục này trước khi chuyển issue sang Ready.';

function areaLabels(requirement) {
  return [`area:${requirement.area}`];
}

function checklist(lines) {
  if (!lines?.length) return REFINE_BEFORE_READY;
  return lines.map((line) => `- [ ] ${line}`).join('\n');
}

function section(heading, content) {
  return `## ${heading}\n\n${content}`;
}

function featureBody(requirement) {
  return [
    `Yêu cầu: ${requirement.id}`,
    section('Bối cảnh', requirement.description ?? requirement.title),
    section('Việc cần làm', 'Các issue con liệt kê bên dưới issue này.'),
    section(
      'Xong khi nào',
      checklist(['Mọi issue con đã đóng', 'Trạng thái yêu cầu trong sổ là implemented']),
    ),
    `Trạng thái yêu cầu: ${requirement.status}\nNguồn: ${requirement.sources.join(', ')}`,
  ].join('\n\n');
}

function legacyTaskBody(requirement) {
  return `Yêu cầu: ${requirement.id}\n\nThuộc: ${requirement.title}`;
}

function taskBody(requirement, item) {
  const context = [`Thuộc: ${requirement.title}`, requirement.description]
    .filter(Boolean)
    .join('\n\n');
  return [
    `Yêu cầu: ${requirement.id}`,
    section('Bối cảnh', context),
    section('Việc cần làm', checklist(item.work)),
    section('Xong khi nào', checklist(item.done)),
  ].join('\n\n');
}

export function planBacklog(requirements, seed, milestones) {
  const errors = [];
  const milestoneTitle = new Map(milestones.map((item) => [item.id, item.title]));
  const issues = [];

  for (const requirement of requirements) {
    if (requirement.status === 'deprecated') continue;
    issues.push({
      key: requirement.id,
      type: 'Feature',
      title: `${requirement.id}: ${requirement.title}`,
      body: featureBody(requirement),
      milestone: milestoneTitle.get(requirement.milestone),
      labels: areaLabels(requirement),
      priority: PRIORITY[requirement.priority],
      status: 'Backlog',
    });
  }

  for (const group of seed.tasks ?? []) {
    const requirement = requirements.find((item) => item.id === group.requirement);
    if (!requirement) {
      errors.push(`backlog seed references unknown ${group.requirement}`);
      continue;
    }
    if (requirement.status === 'deprecated') continue;
    const isReady = READY_REQUIREMENT_STATUSES.includes(requirement.status);
    for (const item of group.items) {
      issues.push({
        key: `${group.requirement}/${item.title}`,
        parent: group.requirement,
        type: 'Task',
        title: item.title,
        body: taskBody(requirement, item),
        legacyBody: legacyTaskBody(requirement),
        milestone: milestoneTitle.get(item.milestone ?? requirement.milestone),
        labels: [...areaLabels(requirement), ...(item.labels ?? [])],
        priority: PRIORITY[requirement.priority],
        size: item.size,
        effort: EFFORT[item.size],
        status: isReady && !item.labels?.length ? 'Ready' : 'Backlog',
      });
    }
  }

  for (const issue of issues) {
    if (!issue.milestone) errors.push(`${issue.key}: unknown milestone`);
  }
  return { issues, errors };
}

function isPlanned(issue, existingTitles) {
  if (issue.type === 'Feature') {
    return existingTitles.some((title) => title.startsWith(`${issue.key}:`));
  }
  return existingTitles.includes(issue.title);
}

export function selectMissingIssues(issues, existingTitles) {
  return issues.filter((issue) => !isPlanned(issue, existingTitles));
}

function matchesPlanned(issue, existingIssue) {
  const requirement = issue.parent ?? issue.key;
  if (!(existingIssue.body ?? '').startsWith(`Yêu cầu: ${requirement}\n`)) return false;
  if (issue.type === 'Feature') return existingIssue.title.startsWith(`${issue.key}:`);
  return existingIssue.title === issue.title;
}

export function planMilestoneMoves(planned, existing) {
  const moves = [];
  for (const existingIssue of existing) {
    const current = existingIssue.milestone?.title;
    if (existingIssue.state !== 'open' || !current) continue;
    const issue = planned.find((item) => matchesPlanned(item, existingIssue));
    if (!issue || current === issue.milestone) continue;
    moves.push({ number: existingIssue.number, from: current, to: issue.milestone });
  }
  return moves;
}

export function findUnknownMilestones(planned, knownTitles) {
  const known = new Set(knownTitles);
  return [...new Set(planned.map((issue) => issue.milestone))].filter((title) => !known.has(title));
}

export function findIssueByKey(existing, key) {
  return existing.find((item) => item.title.startsWith(`${key}:`));
}

function isGeneratedBody(issue, body) {
  if (body.includes('## ')) return false;
  if (issue.type === 'Feature') return body.includes('\nTrạng thái yêu cầu: ');
  return body.trim() === issue.legacyBody;
}

function openMatches(planned, existing) {
  return existing
    .filter((existingIssue) => existingIssue.state === 'open')
    .map((existingIssue) => ({
      existingIssue,
      issue: planned.find((item) => matchesPlanned(item, existingIssue)),
    }))
    .filter((match) => match.issue);
}

export function planBodyUpdates(planned, existing) {
  return openMatches(planned, existing)
    .filter(({ issue, existingIssue }) => isGeneratedBody(issue, existingIssue.body ?? ''))
    .map(({ issue, existingIssue }) => ({ number: existingIssue.number, body: issue.body }));
}

export function planFieldUpdates(planned, existing) {
  return openMatches(planned, existing).map(({ issue, existingIssue }) => ({
    number: existingIssue.number,
    priority: issue.priority,
    ...(issue.effort ? { effort: issue.effort } : {}),
  }));
}

const ISSUE_FIELD_NAMES = { priority: 'Priority', effort: 'Effort' };

export function issueFieldInputs(fields, values) {
  return Object.entries(ISSUE_FIELD_NAMES)
    .filter(([key]) => values[key])
    .map(([key, name]) => {
      const field = fields.find((item) => item.name === name);
      const option = field?.options?.find((item) => item.name === values[key]);
      if (!option) throw new Error(`Issue field ${name} has no option ${values[key]}`);
      return { fieldId: field.id, singleSelectOptionId: option.id };
    });
}
