export type EntryType = 'API_KEY' | 'ACCOUNT';

export type Theme = 'dark' | 'light';

export interface User {
  id: string;
  email: string;
  isAdmin?: boolean;
  hasPassword?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  _count?: { entries: number };
}

export interface Entry {
  id: string;
  type: EntryType;
  name: string;
  icon: string;
  service?: string | null;
  username?: string | null;
  url?: string | null;
  note?: string | null;
  expiresAt?: string | null;
  encryptedData: string;
  categories: Category[];
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedEntry extends Omit<Entry, 'encryptedData'> {
  // For API_KEY type
  apiKey?: string;
  // For ACCOUNT type
  password?: string;
  // TOTP secret imported from Apple Passwords (stored inside the encrypted blob)
  otpAuth?: string;
}

export interface EntryFormData {
  type: EntryType;
  name: string;
  icon: string;
  service?: string;
  username?: string;
  url?: string;
  note?: string;
  expiresAt?: string;
  categoryIds?: string[];
  // Sensitive (will be encrypted)
  apiKey?: string;
  password?: string;
}

export interface Settings {
  id: string;
  autoLockMins: number;
  theme: Theme;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLocked: boolean;
  isSetupComplete: boolean;
}

export interface ApiError {
  error: string;
  details?: { field: string; message: string }[];
}

export type SortField = 'createdAt' | 'updatedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  search: string;
  type: EntryType | 'ALL';
  categoryId: string | null;
  sortBy: SortField;
  sortOrder: SortOrder;
  showExpiredOnly: boolean;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  entries: Entry[];
  categories: Category[];
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: 'Very Weak' | 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
  color: string;
}
