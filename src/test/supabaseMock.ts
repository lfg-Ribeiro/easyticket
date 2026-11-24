import { vi } from "vitest";

export type Row = Record<string, unknown>;

export interface RecordedQuery {
  table: string;
  op: "select" | "delete" | "insert";
  columns?: string;
  filters: [string, unknown][];
  payload?: Row;
}

export interface MockState {
  /** Linhas por tabela. As consultas respeitam .eq()/.is(), como o banco faria. */
  db: Record<string, Row[]>;
  /** Respostas das RPCs, por nome. */
  rpc: (name: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  queries: RecordedQuery[];
  /** true: ignora .eq() (simula uma consulta/RLS que "vazaria" linhas) */
  ignoreFilters?: boolean;
  /** Simula erro de banco num INSERT (ex.: { code: "23505" }); null/undefined = sucesso. */
  onInsert?: (table: string, row: Row) => { code?: string; message?: string } | null | undefined;
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
    let payload: Row | undefined;

    const rows = () => {
      const all = state.db[table] ?? [];
      if (state.ignoreFilters) return all;
      return all.filter(
        (row) =>
          filters.every(([column, value]) => row[column] === value) &&
          nullFilters.every((column) => row[column] == null),
      );
    };

    type Result = { data: Row[]; error: { code?: string; message?: string } | null };

    const run = (): Result => {
      state.queries.push({ table, op, columns, filters: [...filters], payload });
      if (op === "insert") {
        const failure = state.onInsert?.(table, payload as Row);
        if (failure) return { data: [], error: failure };
        const row: Row = { id: `${table}-${(state.db[table] ?? []).length + 1}`, created_at: new Date().toISOString(), ...payload };
        state.db[table] = [...(state.db[table] ?? []), row];
        return { data: [row], error: null };
      }
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
      insert: (row: Row) => {
        op = "insert";
        payload = row;
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
      // filtros extras que algumas telas usam; aqui não restringem o resultado
      gt: () => api,
      gte: () => api,
      lt: () => api,
      lte: () => api,
      neq: () => api,
      like: () => api,
      ilike: () => api,
      or: () => api,
      not: () => api,
      range: () => api,
      maybeSingle: async () => {
        const result = run();
        return { data: result.data[0] ?? null, error: result.error };
      },
      single: async () => {
        const result = run();
        return { data: result.data[0] ?? null, error: result.error };
      },
      then: (resolve: (result: Result) => void) => resolve(run()),
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
