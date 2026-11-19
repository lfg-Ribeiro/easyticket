import { vi } from "vitest";

export type Row = Record<string, unknown>;

export interface RecordedQuery {
  table: string;
  op: "select" | "delete";
  columns?: string;
  filters: [string, unknown][];
}

export interface MockState {
  /** Linhas por tabela. As consultas respeitam .eq()/.is(), como o banco faria. */
  db: Record<string, Row[]>;
  /** Respostas das RPCs, por nome. */
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  queries: RecordedQuery[];
  /** true: ignora .eq() (simula uma consulta/RLS que "vazaria" linhas) */
  ignoreFilters?: boolean;
}

export const createMockState = (): MockState => ({
  db: {},
  rpc: vi.fn(async () => ({ data: null, error: null })),
  queries: [],
});

/** Mini query-builder do Supabase para testes de componentes. */
export function createSupabaseMock(state: MockState) {
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const nullFilters: string[] = [];
    let op: RecordedQuery["op"] = "select";
    let columns: string | undefined;

    const rows = () => {
      const all = state.db[table] ?? [];
      if (state.ignoreFilters) return all;
      return all.filter(
        (row) =>
          filters.every(([column, value]) => row[column] === value) &&
          nullFilters.every((column) => row[column] == null),
      );
    };

    const run = () => {
      state.queries.push({ table, op, columns, filters: [...filters] });
      if (op === "delete") {
        const removed = rows();
        state.db[table] = (state.db[table] ?? []).filter((row) => !removed.includes(row));
        return { data: removed, error: null };
      }
      return { data: rows(), error: null };
    };

    const api: Record<string, unknown> = {
      select: (cols?: string) => {
        if (op === "select") columns = cols;
        return api;
      },
      delete: () => {
        op = "delete";
        return api;
      },
      eq: (column: string, value: unknown) => {
        filters.push([column, value]);
        return api;
      },
      is: (column: string) => {
        nullFilters.push(column);
        return api;
      },
      in: () => api,
      order: () => api,
      limit: () => api,
      maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
      single: async () => ({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (result: { data: Row[]; error: null }) => void) => resolve(run() as { data: Row[]; error: null }),
    };
    return api;
  };

  return {
    from,
    rpc: (name: string, args?: Record<string, unknown>) => state.rpc(name, args),
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    storage: { from: () => ({ upload: vi.fn(), getPublicUrl: vi.fn(() => ({ data: { publicUrl: "" } })) }) },
  };
}
