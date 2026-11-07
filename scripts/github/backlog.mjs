const PRIORITY = { must: 'P1', should: 'P2', could: 'P3' };

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
        status: item.labels?.length ? 'Backlog' : 'Ready',
      });
    }
  }

  for (const issue of issues) {
    if (!issue.milestone) errors.push(`${issue.key}: unknown milestone`);
  }
  return { issues, errors };
}

export function selectMissingIssues(issues, existingTitles) {
  const existing = new Set(existingTitles);
  return issues.filter((issue) => !existing.has(issue.title));
}
