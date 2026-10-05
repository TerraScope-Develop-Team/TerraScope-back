const MAX_PAGE_SIZE = 100;

export function parsePagination(query, defaultLimit = 50) {
  const requestedLimit = Number.parseInt(query.limit, 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), MAX_PAGE_SIZE)
    : defaultLimit;
  const cursor = typeof query.cursor === "string" ? query.cursor.trim() : "";

  return {
    limit,
    cursor: cursor || null,
    validCursor: !cursor || /^[a-f\d]{24}$/i.test(cursor),
  };
}

export function paginateResults(res, records, limit) {
  const hasMore = records.length > limit;
  const items = records.slice(0, limit);
  const nextCursor = hasMore ? items.at(-1)?.id ?? null : null;

  res.set("X-Has-More", String(hasMore));
  res.set("X-Page-Limit", String(limit));
  if (nextCursor) res.set("X-Next-Cursor", nextCursor);

  return { items, hasMore, nextCursor };
}