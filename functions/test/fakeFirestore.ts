/**
 * A tiny Firestore double — just the surface the handlers use: documents,
 * subcollections, equality queries, batches, and a single-threaded
 * transaction. Enough to test what matters (single use, expiry, plan limits,
 * seat counting, key hashing) without standing up an emulator.
 */
type Doc = Record<string, unknown>;

class FakeDocRef {
  constructor(
    private readonly store: Map<string, Doc>,
    readonly id: string,
    readonly path: string,
  ) {}

  collection(name: string) {
    return makeCollection(this.store, `${this.path}/${name}`);
  }

  async delete() {
    this.store.delete(this.path);
  }

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

function makeCollection(store: Map<string, Doc>, prefix: string) {
  let auto = 0;
  return Object.assign(new FakeQuery(store, prefix), {
    doc(id?: string) {
      const docId = id ?? `auto${++auto}_${Math.random().toString(36).slice(2, 8)}`;
      return new FakeDocRef(store, docId, `${prefix}/${docId}`);
    },
  });
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

  orderBy() {
    return this;
  }

  async get() {
    const depth = this.prefix.split("/").length;
    const docs = [...this.store.entries()]
      // Direct children only — a subcollection is not part of its parent query.
      .filter(([path]) => path.startsWith(`${this.prefix}/`) && path.split("/").length === depth + 1)
      .filter(([, data]) => this.filters.every(([field, value]) => data[field] === value))
      .map(([path, data]) => {
        const id = path.split("/").pop()!;
        return {
          id,
          data: () => data,
          get: (field: string) => data[field],
          ref: new FakeDocRef(this.store, id, path),
        };
      });
    return { size: docs.length, docs, empty: docs.length === 0 };
  }
}

export class FakeFirestore {
  readonly data = new Map<string, Doc>();

  collection(name: string) {
    return makeCollection(this.data, name);
  }

  /** Enough of a transaction for tests: the fake is single-threaded anyway. */
  async runTransaction<T>(fn: (tx: {
    get: (ref: FakeDocRef) => ReturnType<FakeDocRef["get"]>;
    set: (ref: FakeDocRef, value: Doc, options?: { merge?: boolean }) => void;
  }) => Promise<T>): Promise<T> {
    const writes: (() => Promise<void>)[] = [];
    const result = await fn({
      get: (ref) => ref.get(),
      set: (ref, value, options) => void writes.push(() => ref.set(value, options)),
    });
    for (const write of writes) await write();
    return result;
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

  seedMember(teamId: string, uid: string, fields: Doc = {}) {
    this.data.set(`teams/${teamId}/members/${uid}`, {
      uid,
      email: `${uid}@example.com`,
      role: "member",
      ...fields,
    });
  }
}
