// A small in-memory stand-in for the Supabase client, for testing the webhook
// handlers end to end without a database. It implements only the query shapes
// the connectors use: eq / is / gte / like / in / contains / filter("cs"),
// order, limit, single, insert, update, upsert, delete and the contacts(...)
// embed. Test-only: no function imports it, so it is never deployed.

type Row = Record<string, unknown>;
type Result = {
  data: unknown;
  error: null | { message: string; code?: string };
  count?: number;
};

const matchesJson = (value: unknown, wanted: unknown): boolean => {
  if (Array.isArray(wanted))
    return (
      Array.isArray(value) &&
      wanted.every((w) => value.some((v) => matchesJson(v, w)))
    );
  if (wanted && typeof wanted === "object")
    return (
      !!value &&
      typeof value === "object" &&
      Object.entries(wanted).every(([k, w]) =>
        matchesJson((value as Row)[k], w),
      )
    );
  return value === wanted;
};

class Query implements PromiseLike<Result> {
  private filters: Array<(row: Row) => boolean> = [];
  private sorts: Array<[string, boolean]> = [];
  private max = Infinity;
  private action: "select" | "insert" | "update" | "upsert" | "delete" =
    "select";
  private payload: Row | Row[] = {};
  private upsertKey = "";
  private columns = "*";
  private head = false;
  private countRows = false;
  private wantSingle = false;
  private returning = false;

  constructor(
    private db: TestDb,
    private table: string,
  ) {}

  select(columns = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = columns;
    if (opts?.head) this.head = true;
    if (opts?.count) this.countRows = true;
    // after insert/update/delete, select() means "return the changed rows"
    if (this.action !== "select") this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.action = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.action = "update";
    this.payload = patch;
    return this;
  }
  upsert(row: Row | Row[], opts?: { onConflict?: string }) {
    this.action = "upsert";
    this.payload = row;
    this.upsertKey = opts?.onConflict ?? "id";
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push((r) => (r[col] ?? null) === value);
    return this;
  }
  gte(col: string, value: string | number) {
    this.filters.push((r) => (r[col] as string | number) >= value);
    return this;
  }
  in(col: string, values: unknown[]) {
    this.filters.push((r) => values.includes(r[col]));
    return this;
  }
  like(col: string, pattern: string) {
    const re = new RegExp(
      `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`,
    );
    this.filters.push(
      (r) => typeof r[col] === "string" && re.test(r[col] as string),
    );
    return this;
  }
  contains(col: string, wanted: unknown) {
    this.filters.push((r) => matchesJson(r[col], wanted));
    return this;
  }
  filter(col: string, op: string, value: string) {
    if (op !== "cs") throw new Error(`TestDb: filter op ${op} not supported`);
    this.filters.push((r) => matchesJson(r[col], JSON.parse(value)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push([col, opts?.ascending !== false]);
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  single() {
    this.wantSingle = true;
    return this;
  }
  maybeSingle() {
    this.wantSingle = true;
    return this;
  }

  private rows(): Row[] {
    return this.db
      .table(this.table)
      .filter((r) => this.filters.every((f) => f(r)));
  }

  private project(rows: Row[]): Row[] {
    const embeds = [...this.columns.matchAll(/(\w+)\(([^)]*)\)/g)];
    const plain = this.columns
      .replace(/(\w+)\(([^)]*)\)/g, "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    return rows.map((row) => {
      const out: Row =
        plain.includes("*") || !plain.length
          ? { ...row }
          : Object.fromEntries(plain.map((c) => [c, row[c] ?? null]));
      for (const [, relation, fields] of embeds) {
        const fk = `${relation.replace(/s$/, "")}_id`;
        const target = this.db.table(relation).find((r) => r.id === row[fk]);
        out[relation] = target
          ? Object.fromEntries(
              fields
                .split(",")
                .map((f) => [f.trim(), target[f.trim()] ?? null]),
            )
          : null;
      }
      return out;
    });
  }

  private run(): Result {
    const table = this.db.table(this.table);
    let changed: Row[] = [];
    if (this.action === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      changed = rows.map((r) => this.db.add(this.table, r));
    } else if (this.action === "upsert") {
      const incoming = Array.isArray(this.payload)
        ? this.payload
        : [this.payload];
      changed = incoming.map((row) => {
        // onConflict may name several columns, like the database does
        const keys = this.upsertKey.split(",").map((k) => k.trim());
        const existing = table.find((r) => keys.every((k) => r[k] === row[k]));
        if (existing) return Object.assign(existing, row);
        return this.db.add(this.table, row);
      });
    } else if (this.action === "update") {
      changed = this.rows();
      changed.forEach((r) => Object.assign(r, this.payload));
    } else if (this.action === "delete") {
      changed = this.rows();
      this.db.tables[this.table] = table.filter((r) => !changed.includes(r));
    }
    const found = this.action === "select" ? this.rows() : changed;
    if (this.action === "select") {
      for (const [col, ascending] of [...this.sorts].reverse())
        found.sort((a, b) => {
          const x = a[col] as string | number;
          const y = b[col] as string | number;
          return (x < y ? -1 : x > y ? 1 : 0) * (ascending ? 1 : -1);
        });
    }
    const limited = found.slice(0, this.max);
    if (this.head) return { data: null, error: null, count: found.length };
    const shaped =
      this.action === "select" || this.returning ? this.project(limited) : null;
    if (this.wantSingle) return { data: shaped?.[0] ?? null, error: null };
    return {
      data: shaped,
      error: null,
      ...(this.countRows ? { count: found.length } : {}),
    };
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve()
      .then(() => this.run())
      .then(onfulfilled, onrejected);
  }
}

export class TestDb {
  tables: Record<string, Row[]> = {};
  private sequences: Record<string, number> = {};

  table(name: string): Row[] {
    return (this.tables[name] ??= []);
  }

  /** Adds a row (ids are assigned when missing) and returns it. */
  add(name: string, row: Row): Row {
    const id =
      (row.id as number | undefined) ??
      (this.sequences[name] = (this.sequences[name] ?? 0) + 1);
    this.sequences[name] = Math.max(this.sequences[name] ?? 0, id);
    const stored = { ...row, id };
    this.table(name).push(stored);
    return stored;
  }

  from(name: string) {
    return new Query(this, name);
  }

  rpc(name: string, args: { p_name: string }) {
    if (name !== "get_or_create_tag")
      throw new Error(`TestDb: rpc ${name} not supported`);
    const key = args.p_name.trim().toLowerCase();
    const tag =
      this.table("tags").find((t) => String(t.name).toLowerCase() === key) ??
      this.add("tags", { name: args.p_name.trim() });
    return Promise.resolve({ data: { id: tag.id }, error: null });
  }
}
