/**
 * A tiny Firestore double — just the surface connect.ts uses. Enough to test
 * the parts that matter (single use, expiry, plan limits, key hashing) without
 * standing up an emulator.
 */
type Doc = Record<string, unknown>;

class FakeDocRef {
  constructor(
    private readonly store: Map<string, Doc>,
    readonly id: string,
    private readonly path: string,
  ) {}

  async get() {
    const data = this.store.get(this.path);
    return {
      exists: data !== undefined,
      id: this.id,
      data: () => data,
      get: (field: string) => data?.[field],
    };
  }

  async set(value: Doc, options?: { merge?: boolean }) {
    const prev = options?.merge ? (this.store.get(this.path) ?? {}) : {};
    this.store.set(this.path, { ...prev, ...value });
  }
}

class FakeQuery {
  constructor(
    private readonly store: Map<string, Doc>,
    private readonly prefix: string,
    private readonly filters: [string, unknown][] = [],
  ) {}

  where(field: string, _op: string, value: unknown) {
    return new FakeQuery(this.store, this.prefix, [...this.filters, [field, value]]);
  }

  limit(_n: number) {
    return this;
  }

  async get() {
    const docs = [...this.store.entries()]
      .filter(([path]) => path.startsWith(`${this.prefix}/`))
      .filter(([, data]) => this.filters.every(([field, value]) => data[field] === value))
      .map(([path, data]) => ({ id: path.split("/").pop()!, data: () => data }));
    return { size: docs.length, docs, empty: docs.length === 0 };
  }
}

export class FakeFirestore {
  readonly data = new Map<string, Doc>();
  private autoId = 0;

  collection(name: string) {
    const store = this.data;
    const self = this;
    return Object.assign(new FakeQuery(store, name), {
      doc(id?: string) {
        const docId = id ?? `auto${++self.autoId}`;
        return new FakeDocRef(store, docId, `${name}/${docId}`);
      },
    });
  }

  batch() {
    const ops: (() => Promise<void>)[] = [];
    return {
      set(ref: FakeDocRef, value: Doc, options?: { merge?: boolean }) {
        ops.push(() => ref.set(value, options));
      },
      async commit() {
        for (const op of ops) await op();
      },
    };
  }

  seedTeam(teamId: string, plan: "free" | "pro") {
    this.data.set(`teams/${teamId}`, { plan, name: teamId });
  }

  seedCode(code: string, value: Doc) {
    this.data.set(`connectCodes/${code}`, value);
  }

  seedProject(projectId: string, teamId: string) {
    this.data.set(`projects/${projectId}`, { teamId, name: projectId });
  }
}
