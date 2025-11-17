import type { Session } from "./types.js";

export class SessionImpl implements Session {
  private data = new Map<string, unknown>();

  constructor(public readonly did: string) {}

  get<T = unknown>(key: string): T | undefined {
    return this.data.get(key) as T | undefined;
  }

  set<T = unknown>(key: string, value: T): void {
    this.data.set(key, value);
  }

  has(key: string): boolean {
    return this.data.has(key);
  }

  delete(key: string): boolean {
    return this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

export class SessionStore {
  private sessions = new Map<string, Session>();

  get(did: string): Session | undefined {
    return this.sessions.get(did);
  }

  getOrCreate(did: string): Session {
    let session = this.sessions.get(did);
    if (!session) {
      session = new SessionImpl(did);
      this.sessions.set(did, session);
    }
    return session;
  }
}
