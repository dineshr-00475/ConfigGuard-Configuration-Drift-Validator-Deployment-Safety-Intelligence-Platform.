import { AuthUser, EnterpriseRole } from '../types';

export interface DemoAccount {
  name: string;
  email: string;
  password: string;
  role: EnterpriseRole;
  description: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'admin123',
    role: 'ADMIN',
    description: 'Full access: Manage users, validation policies, approve releases & system configuration.',
  },
  {
    name: 'DevOps Engineer',
    email: 'devops@example.com',
    password: 'devops123',
    role: 'DEVOPS',
    description: 'Operational control: Fix configs, manage runtime infrastructure, rollbacks & secret metadata.',
  },
  {
    name: 'Release Manager',
    email: 'release@example.com',
    password: 'release123',
    role: 'RELEASE_MANAGER',
    description: 'Release Gatekeeper: Review risk scores, approve or block Production deployments.',
  },
  {
    name: 'Senior Developer',
    email: 'developer@example.com',
    password: 'dev123',
    role: 'DEVELOPER',
    description: 'Feature delivery: View drifts, run simulations, compare baselines & draft change requests.',
  },
  {
    name: 'Compliance Auditor',
    email: 'auditor@example.com',
    password: 'audit123',
    role: 'AUDITOR',
    description: 'Read-only access: View environment health, drift histories, and audit records.',
  },
];

const AUTH_STORAGE_KEY = 'cdv_authenticated_user';
const TOKEN_STORAGE_KEY = 'cdv_access_token';
const EXPIRY_STORAGE_KEY = 'cdv_session_expiry';
const USERS_LIST_STORAGE_KEY = 'cdv_registered_users';

export interface StoredUserRecord {
  id: string;
  name: string;
  email: string;
  role: EnterpriseRole;
  status: 'ACTIVE' | 'DISABLED';
  passwordHash: string;
  lastLogin: string;
  createdAt: string;
  twoFactorEnabled?: boolean;
}

// Simple fast SHA-256 for browser client demo storage
async function computeSha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + '_cdv_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Initialize default users if not in localStorage
export async function initializeRegisteredUsers(): Promise<StoredUserRecord[]> {
  try {
    const raw = localStorage.getItem(USERS_LIST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading users from storage:', err);
  }

  const initialList: StoredUserRecord[] = [];
  for (let i = 0; i < DEMO_ACCOUNTS.length; i++) {
    const acc = DEMO_ACCOUNTS[i];
    const hash = await computeSha256(acc.password);
    initialList.push({
      id: `user-${i + 1}`,
      name: acc.name,
      email: acc.email,
      role: acc.role,
      status: 'ACTIVE',
      passwordHash: hash,
      lastLogin: new Date().toISOString(),
      createdAt: '2026-09-01T08:00:00.000Z',
      twoFactorEnabled: acc.role === 'ADMIN',
    });
  }

  try {
    localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(initialList));
  } catch (err) {
    console.error('Error saving initial users:', err);
  }
  return initialList;
}

export async function authenticate(
  emailInput: string,
  passwordInput: string,
  rememberMe: boolean = false
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!email) {
    return { success: false, error: 'Email address is required.' };
  }
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  // Ensure users initialized
  const usersList = await initializeRegisteredUsers();
  const users = Array.isArray(usersList) ? usersList : [];
  const found = users.find((u) => u.email.toLowerCase() === email);

  if (!found) {
    return { success: false, error: '❌ Invalid email or password' };
  }

  if (found.status === 'DISABLED') {
    return { success: false, error: 'Account has been disabled by an administrator.' };
  }

  const inputHash = await computeSha256(password);
  if (found.passwordHash !== inputHash) {
    return { success: false, error: '❌ Invalid email or password' };
  }

  // Token valid for 30 min (or 24 hours if rememberMe)
  const durationMinutes = rememberMe ? 60 * 24 : 30;
  const expiryTimestamp = Date.now() + durationMinutes * 60 * 1000;
  const dummyJwt = `eyJhbGciOiJIUzI1NiJ9.${btoa(
    JSON.stringify({ sub: found.id, email: found.email, role: found.role, exp: expiryTimestamp })
  )}.sig_${Date.now()}`;

  const authUser: AuthUser = {
    id: found.id,
    name: found.name,
    email: found.email,
    role: found.role,
    status: found.status,
    lastLogin: new Date().toISOString(),
    token: dummyJwt,
    twoFactorEnabled: found.twoFactorEnabled,
    avatar: found.name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .substring(0, 2)
      .toUpperCase(),
  };

  // Update last login in stored users list
  found.lastLogin = new Date().toISOString();
  try {
    localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));
    const storageTarget = rememberMe ? localStorage : sessionStorage;
    storageTarget.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
    storageTarget.setItem(TOKEN_STORAGE_KEY, dummyJwt);
    storageTarget.setItem(EXPIRY_STORAGE_KEY, expiryTimestamp.toString());
    // Also clear the other storage so no stale conflict
    const otherStorage = rememberMe ? sessionStorage : localStorage;
    otherStorage.removeItem(AUTH_STORAGE_KEY);
    otherStorage.removeItem(TOKEN_STORAGE_KEY);
    otherStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch (err) {
    console.error('Error saving session:', err);
  }

  return { success: true, user: authUser };
}

export function getCurrentUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY) || sessionStorage.getItem(AUTH_STORAGE_KEY);
    const exp = localStorage.getItem(EXPIRY_STORAGE_KEY) || sessionStorage.getItem(EXPIRY_STORAGE_KEY);

    if (!raw || !exp) return null;

    const expiryNum = parseInt(exp, 10);
    if (Date.now() > expiryNum) {
      logout();
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function logout(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(EXPIRY_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(EXPIRY_STORAGE_KEY);
  } catch (err) {
    console.error('Error clearing session:', err);
  }
}

export function canUser(
  role: EnterpriseRole | string,
  action:
    | 'VIEW_DASHBOARD'
    | 'RUN_VALIDATION'
    | 'CREATE_CHANGE_REQUEST'
    | 'VIEW_DRIFT'
    | 'RUN_SIMULATION'
    | 'FIX_CONFIGURATION'
    | 'ROLLBACK_PROD'
    | 'APPROVE_PROD_DEPLOYMENT'
    | 'REJECT_DEPLOYMENT'
    | 'MANAGE_USERS'
    | 'MANAGE_SYSTEM_SETTINGS'
    | 'MANAGE_VALIDATION_POLICIES'
    | 'MANAGE_DEPLOYMENT_POLICIES'
): boolean {
  const normRole = (role || '').toString().toUpperCase().replace(/\s+/g, '_');

  if (normRole === 'ADMIN') return true;

  switch (action) {
    case 'VIEW_DASHBOARD':
    case 'VIEW_DRIFT':
    case 'RUN_VALIDATION':
      return true;

    case 'CREATE_CHANGE_REQUEST':
      return ['DEVELOPER', 'DEVOPS', 'RELEASE_MANAGER'].includes(normRole);

    case 'RUN_SIMULATION':
      return ['DEVELOPER', 'DEVOPS'].includes(normRole);

    case 'FIX_CONFIGURATION':
    case 'ROLLBACK_PROD':
      return normRole === 'DEVOPS';

    case 'APPROVE_PROD_DEPLOYMENT':
    case 'REJECT_DEPLOYMENT':
      return normRole === 'RELEASE_MANAGER';

    case 'MANAGE_USERS':
    case 'MANAGE_SYSTEM_SETTINGS':
    case 'MANAGE_VALIDATION_POLICIES':
    case 'MANAGE_DEPLOYMENT_POLICIES':
      return false; // Admin only handled above

    default:
      return false;
  }
}

export async function getRegisteredUsersList(): Promise<StoredUserRecord[]> {
  return initializeRegisteredUsers();
}

export async function createNewUser(
  name: string,
  email: string,
  role: EnterpriseRole,
  passwordInput: string
): Promise<{ success: boolean; user?: StoredUserRecord; error?: string }> {
  const users = await initializeRegisteredUsers();
  const cleanEmail = email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
    return { success: false, error: 'User with this email already exists.' };
  }

  const hash = await computeSha256(passwordInput);
  const newUser: StoredUserRecord = {
    id: `user-${Date.now()}`,
    name: name.trim(),
    email: cleanEmail,
    role,
    status: 'ACTIVE',
    passwordHash: hash,
    lastLogin: 'Never',
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));
  return { success: true, user: newUser };
}

export async function toggleUserStatus(userId: string): Promise<boolean> {
  const users = await initializeRegisteredUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return false;

  target.status = target.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));
  return true;
}

export async function resetUserPassword(
  userId: string,
  newPasswordPlain: string = 'Password@123'
): Promise<boolean> {
  const users = await initializeRegisteredUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return false;

  target.passwordHash = await computeSha256(newPasswordPlain);
  localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));
  return true;
}

export async function updateUserProfile(
  userId: string,
  updates: { name?: string; email?: string; role?: EnterpriseRole }
): Promise<boolean> {
  const users = await initializeRegisteredUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return false;

  if (updates.name) target.name = updates.name.trim();
  if (updates.email) target.email = updates.email.trim().toLowerCase();
  if (updates.role) target.role = updates.role;

  localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));

  // If updating the active user session, update it too
  const current = getCurrentUser();
  if (current && current.id === userId) {
    const updatedCurrent: AuthUser = {
      ...current,
      name: target.name,
      email: target.email,
      role: target.role,
    };
    if (localStorage.getItem(AUTH_STORAGE_KEY)) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedCurrent));
    } else {
      sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedCurrent));
    }
  }

  return true;
}

export async function changeUserPassword(
  userId: string,
  currentPasswordPlain: string,
  newPasswordPlain: string
): Promise<{ success: boolean; error?: string }> {
  const users = await initializeRegisteredUsers();
  const target = users.find((u) => u.id === userId);
  if (!target) return { success: false, error: 'User not found.' };

  const currentHash = await computeSha256(currentPasswordPlain);
  if (target.passwordHash !== currentHash) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  if (newPasswordPlain.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters long.' };
  }

  target.passwordHash = await computeSha256(newPasswordPlain);
  localStorage.setItem(USERS_LIST_STORAGE_KEY, JSON.stringify(users));
  return { success: true };
}
