import { useQuery } from "@tanstack/react-query";
import { useDataProvider } from "ra-core";

// The database answers at most 1000 rows per request, so a long period is
// fetched page by page until a page comes back short
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

interface AllRecordsOptions {
  filter?: Record<string, unknown>;
  sort?: { field: string; order: "ASC" | "DESC" };
  /** Only these columns, to keep wide tables light. Must include "id". */
  columns?: string[];
  enabled?: boolean;
}

/** Every record matching the filter, however many pages that takes. */
export const useAllRecords = <T>(
  resource: string,
  {
    filter = {},
    sort = { field: "id", order: "ASC" },
    columns,
    enabled = true,
  }: AllRecordsOptions = {},
) => {
  const dataProvider = useDataProvider();
  return useQuery({
    queryKey: ["numbers", resource, filter, sort, columns],
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const rows: T[] = [];
      for (let page = 1; page <= MAX_PAGES; page++) {
        const { data } = await dataProvider.getList<T & { id: number }>(
          resource,
          {
            pagination: { page, perPage: PAGE_SIZE },
            sort,
            filter,
            meta: columns ? { columns } : undefined,
          },
        );
        rows.push(...(data as T[]));
        if (data.length < PAGE_SIZE) break;
      }
      return rows;
    },
  });
};
