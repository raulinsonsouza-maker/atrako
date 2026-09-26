export function buildMercadoLivreMonthlyRanges(
  dateFrom: string,
  dateTo: string,
): Array<{ dateFrom: string; dateTo: string }> {
  const start = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T23:59:59.999Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
  const ranges: Array<{ dateFrom: string; dateTo: string }> = [];
  for (let cursor = start; cursor <= end;) {
    const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    ranges.push({
      dateFrom: cursor.toISOString().slice(0, 10),
      dateTo: (monthEnd > end ? end : monthEnd).toISOString().slice(0, 10),
    });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
  }
  return ranges;
}

export function shouldContinueMercadoLivrePagination(input: {
  received: number;
  offset: number;
  limit: number;
  total: number;
}): boolean {
  return input.received === input.limit && input.offset + input.received < input.total;
}
