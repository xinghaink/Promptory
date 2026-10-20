export type VariableType = 'text' | 'textarea' | 'select';

export interface Variable {
  name: string;
  type: VariableType;
  default: string;
  /** Choices for `select` variables. */
  options: string[];
}

export interface Draft {
  content: string;
  variables: Variable[];
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  folderId: string | null;
  tags: string[];
  models: string[];
  /** Quick keyword used after `/` on AI sites, stored without the slash. */
  shortcut: string;
  isFavorite: boolean;
  inInbox: boolean;
  sourceUrl: string;
  /** Unsaved edits to content/variables; saving turns them into a version. */
  draft: Draft | null;
  recommendedVersion: number;
  latestVersion: number;
  /** Values filled in on the last use, keyed by variable name. */
  lastValues: Record<string, string>;
  useCount: number;
  lastUsedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Version {
  id: string;
  promptId: string;
  number: number;
  content: string;
  variables: Variable[];
  note: string;
  useCount: number;
  goodCount: number;
  badCount: number;
  createdAt: number;
}

export interface Folder {
  id: string;
  name: string;
  order: number;
}

/** A prompt together with the version that gets used by default. */
export interface PromptWithVersion {
  prompt: Prompt;
  version: Version;
}

export const MODEL_CHOICES = ['Claude', 'GPT', 'Gemini', 'DeepSeek', '豆包', 'Kimi', '通用'];
