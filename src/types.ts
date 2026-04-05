export interface ListItem {
  rank: number;
  title: string;
  description: string;
  why: string;
  isProduct?: boolean;     // true if this is a buyable product
  buyLinks?: { name: string; url: string }[]; // trusted purchase links
  sourceName?: string;
  sourceUrl?: string;
}

export type Tone = "serious" | "funny" | "educational" | "controversial";

export interface List {
  id: string;
  topic: string;
  tone: Tone;
  items: ListItem[];
  createdAt: string;
  authorId?: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}
