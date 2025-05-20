import { and, or, sql, eq, SQL, Column } from 'drizzle-orm';

export interface PaginationFilterResult {
  offset: number;
  limit: number;
  page: number;
  limitValue: number;
  status?: string;
  search?: string;
  filters: Record<string, unknown>;
}

export function buildPaginationAndFilters(query: Record<string, unknown>): PaginationFilterResult {
  const page = query.page as number;
  const limitValue = query.limit as number;
  const offset = (page - 1) * limitValue;
  const status = query.status as string | undefined;
  const search = query.search as string | undefined;
  const filters: Record<string, unknown> = {};
  if (status) filters.status = status;
  if (search) filters.search = search;
  return { offset, limit: limitValue, page, limitValue, status, search, filters };
}

// Generic where clause builder for status/search
// columns.status and columns.search should be drizzle-orm column references
export function buildWhereClause(
  { status, search }: { status?: string; search?: string },
  columns: { status?: Column; search?: Column[] },
): SQL<unknown> {
  const conditions: SQL<unknown>[] = [];

  if (status && columns.status) {
    conditions.push(eq(columns.status, status));
  }

  if (search && columns.search && columns.search.length > 0) {
    const searchConditions = columns.search.map(
      col => sql`LOWER(${col}) LIKE LOWER(${'%' + search + '%'})`,
    );
    if (searchConditions.length > 0) {
      const orClause = or(...searchConditions);
      if (orClause) conditions.push(orClause);
    }
  }

  if (conditions.length === 0) return sql`1=1`;
  if (conditions.length === 1) return conditions[0];
  const andClause = and(...conditions);
  return andClause ?? sql`1=1`;
}
