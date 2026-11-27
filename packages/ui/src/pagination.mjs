export function pageSteps(page, totalPages) {
  return {
    previous: totalPages > 0 && page > 1 ? Math.min(page - 1, totalPages) : null,
    next: page < totalPages ? Math.max(page + 1, 1) : null,
  };
}
