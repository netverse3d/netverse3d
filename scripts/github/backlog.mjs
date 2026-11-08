const PRIORITY = { must: 'P1', should: 'P2', could: 'P3' };
const READY_REQUIREMENT_STATUSES = ['accepted', 'implemented'];

function areaLabels(requirement) {
  return [`area:${requirement.area}`];
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
      body: [
        `Yêu cầu: ${requirement.id}`,
        '',
        requirement.description ?? '',
        '',
        `Trạng thái yêu cầu: ${requirement.status}`,
        `Nguồn: ${requirement.sources.join(', ')}`,
      ].join('\n'),
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
        body: `Yêu cầu: ${group.requirement}\n\nThuộc: ${requirement.title}`,
        milestone: milestoneTitle.get(requirement.milestone),
        labels: [...areaLabels(requirement), ...(item.labels ?? [])],
        priority: PRIORITY[requirement.priority],
        size: item.size,
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
  if (issue.type === 'Feature') return existingIssue.title.startsWith(`${issue.key}:`);
  return existingIssue.title === issue.title;
}

export function planMilestoneMoves(planned, existing) {
  const moves = [];
  for (const existingIssue of existing) {
    if (existingIssue.state !== 'open') continue;
    const issue = planned.find((item) => matchesPlanned(item, existingIssue));
    const current = existingIssue.milestone?.title ?? null;
    if (!issue || current === issue.milestone) continue;
    moves.push({ number: existingIssue.number, from: current, to: issue.milestone });
  }
  return moves;
}

export function findIssueByKey(existing, key) {
  return existing.find((item) => item.title.startsWith(`${key}:`));
}
