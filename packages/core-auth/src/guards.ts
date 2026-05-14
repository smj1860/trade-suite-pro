import type { UserRole, ModuleName } from '@trades-saas/core-types';

// ─── Guard result ─────────────────────────────────────────────────────────────

export type GuardResult =
  | { pass: true }
  | { pass: false; reason: 'unauthenticated' | 'unauthorized' | 'module_inactive'; redirectTo: string };

// ─── Auth guard ───────────────────────────────────────────────────────────────
//
//  Use at the top of any protected page/layout.
//  Redirects to /auth/login if there's no session.

export function authGuard(isAuthenticated: boolean): GuardResult {
  if (!isAuthenticated) {
    return { pass: false, reason: 'unauthenticated', redirectTo: '/auth/login' };
  }
  return { pass: true };
}

// ─── Role guard ───────────────────────────────────────────────────────────────
//
//  Use for pages that require owner or admin.
//  Example: settings, billing, user management.

export function roleGuard(
  userRole: UserRole,
  requiredRoles: UserRole[]
): GuardResult {
  if (!requiredRoles.includes(userRole)) {
    return { pass: false, reason: 'unauthorized', redirectTo: '/dashboard' };
  }
  return { pass: true };
}

// ─── Module guard ─────────────────────────────────────────────────────────────
//
//  Use at the layout level of each module.
//  If the module isn't active, redirect to the upgrade page.
//
//  Example (in leads/layout):
//    const result = moduleGuard(org.active_modules, 'leads');
//    if (!result.pass) redirect(result.redirectTo);

export function moduleGuard(
  activeModules: ModuleName[],
  requiredModule: ModuleName
): GuardResult {
  if (!activeModules.includes(requiredModule)) {
    return {
      pass: false,
      reason: 'module_inactive',
      redirectTo: `/settings/billing?module=${requiredModule}`,
    };
  }
  return { pass: true };
}

// ─── Compound guard ───────────────────────────────────────────────────────────
//
//  Checks auth + role + module in one call.
//  First failing guard wins.

export function compoundGuard(checks: GuardResult[]): GuardResult {
  for (const check of checks) {
    if (!check.pass) return check;
  }
  return { pass: true };
}
