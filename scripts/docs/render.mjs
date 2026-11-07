const STATUS_LABELS = {
  draft: 'Nháp',
  accepted: 'Đã chốt',
  implemented: 'Đã làm',
  deprecated: 'Đã bỏ',
  proposed: 'Đề xuất',
  superseded: 'Đã thay thế',
};
const PRIORITY_LABELS = { must: 'Bắt buộc', should: 'Nên có', could: 'Có thì tốt' };

function escapeCell(text = '') {
  return String(text).replaceAll('|', '\\|');
}

function table(headers, rows) {
  const align = headers.map(() => '---');
  return [headers, align, ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

export function renderRequirements(requirements, milestones) {
  const sections = milestones.flatMap((milestone) => {
    const items = requirements.filter((item) => item.milestone === milestone.id);
    if (items.length === 0) return [];
    const rows = items.map((item) => [
      item.id,
      escapeCell(item.title),
      STATUS_LABELS[item.status],
      PRIORITY_LABELS[item.priority],
      `\`${item.area}\``,
    ]);
    return [
      `## ${milestone.title}`,
      table(['Mã', 'Yêu cầu', 'Trạng thái', 'Ưu tiên', 'Thành phần'], rows),
    ];
  });
  const details = requirements.flatMap((item) => [
    `### ${item.id}: ${item.title}`,
    `${item.description ?? ''}\n\nNguồn: ${item.sources.map((source) => `\`${source}\``).join(', ')}`,
  ]);
  return [
    '# Sổ yêu cầu',
    'Trang này được sinh từ `docs/requirements/registry.yaml`. Sửa trong tệp đó rồi chạy `pnpm docs:generate`.',
    ...sections,
    '## Chi tiết',
    ...details,
  ]
    .join('\n\n')
    .concat('\n');
}

export function renderDecisions(decisions) {
  const rows = decisions.map((decision) => [
    `[${decision.id}](./${decision.file})`,
    escapeCell(decision.title),
    STATUS_LABELS[decision.status] ?? decision.status,
  ]);
  return [
    '# Sổ quyết định',
    'Trang này được sinh từ các tệp ADR trong `docs/decisions`.',
    table(['Mã', 'Quyết định', 'Trạng thái'], rows),
  ]
    .join('\n\n')
    .concat('\n');
}

export function renderRoadmap(requirements, milestones) {
  const rows = milestones.map((milestone) => {
    const items = requirements.filter((item) => item.milestone === milestone.id);
    const codes = items.map((item) => item.id).join(', ');
    return [escapeCell(milestone.title), escapeCell(milestone.goal), codes || 'Chưa có'];
  });
  return [
    '# Lộ trình',
    'Trang này được sinh từ `docs/requirements/milestones.yaml` và sổ yêu cầu. Thứ tự theo phụ thuộc; ngày cụ thể chờ mốc của nhà trường.',
    table(['Milestone', 'Mục tiêu', 'Yêu cầu'], rows),
  ]
    .join('\n\n')
    .concat('\n');
}

export function renderCatalog(components) {
  const rows = components.map((component) => [
    `\`${component.path}\``,
    component.kind,
    escapeCell(component.stack),
    escapeCell(component.summary),
    component.milestone,
  ]);
  return [
    '# Danh sách thành phần',
    'Trang này được sinh từ `docs/catalog.yaml`.',
    table(['Đường dẫn', 'Loại', 'Stack', 'Vai trò', 'Milestone'], rows),
  ]
    .join('\n\n')
    .concat('\n');
}
