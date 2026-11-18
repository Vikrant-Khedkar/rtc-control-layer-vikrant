import type { Actor, Audit, RecordType, Records, Settings } from "./model";

export interface WorkReader {
  settings(lock?: boolean): Promise<Settings>;
  get<K extends RecordType>(kind: K, id: string, lock?: boolean): Promise<Records[K] | undefined>;
  list<K extends RecordType>(kind: K): Promise<Records[K][]>;
  enquiryByRef(ref: string): Promise<Records["enquiries"] | undefined>;
  quoteByEnquiry(enquiryId: string): Promise<Records["quotes"] | undefined>;
  jobByQuote(quoteId: string): Promise<Records["jobs"] | undefined>;
  actors(): Promise<Actor[]>;
  auditFor(ids: string[]): Promise<Audit[]>;
}

export interface WorkTransaction extends WorkReader {
  insert<K extends RecordType>(kind: K, record: Records[K]): Promise<boolean>;
  update<K extends RecordType>(kind: K, record: Records[K]): Promise<void>;
  replaceSettings(settings: Settings): Promise<void>;
  append(event: Audit): Promise<void>;
}

export interface WorkStore {
  read: WorkReader;
  transaction<T>(operation: (tx: WorkTransaction) => Promise<T>): Promise<T>;
}

export interface IdentityProvider {
  resolve(token: string): Promise<Actor | undefined>;
  switchTo(role: Actor["role"], previousToken?: string): Promise<{ token: string; expiresAt: Date }>;
  revoke(token: string): Promise<void>;
}

export interface RateProvider {
  rate(): Promise<{ cents: number; currency: string }>;
}

export type WorkflowDependencies = {
  store: WorkStore;
  rates: RateProvider;
  now: () => Date;
  id: () => string;
};
