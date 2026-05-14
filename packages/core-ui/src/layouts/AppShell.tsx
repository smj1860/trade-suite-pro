import React from 'react';
import type { ModuleName } from '@trades-saas/core-types';
import { MODULE_DISPLAY_NAMES } from '@trades-saas/core-types';
import { SyncStatus } from '../components/ModuleGate';
import type { SyncState } from '../components/ModuleGate';

// =============================================================================
// APP SHELL
//
// The top-level layout for the TradeSuite PWA.
// Renders:
//   - Optional offline banner (top)
//   - Main scrollable content area
//   - Bottom navigation bar (fixed, mobile-first)
//
// The shell reads activeModules to show only unlocked nav items.
// =============================================================================

export interface NavItem {
  id:      string;
  label:   string;
  icon:    React.ReactNode;
  href:    string;
  module?: ModuleName;   // if set, only shown when module is active
  badge?:  number;       // notification count
}

export interface AppShellProps {
  children:      React.ReactNode;
  navItems:      NavItem[];
  activeModules: ModuleName[];
  currentPath:   string;
  syncState:     SyncState;
  onNavigate:    (href: string) => void;
}

export function AppShell({
  children,
  navItems,
  activeModules,
  currentPath,
  syncState,
  onNavigate,
}: AppShellProps) {
  // Filter nav items — only show items for active modules (plus core items)
  const visibleNavItems = navItems.filter(
    item => !item.module || activeModules.includes(item.module)
  );

  const isOffline = syncState === 'offline';

  return (
    <div className="flex flex-col h-[100dvh] bg-surface font-display">
      {/* Offline banner — only visible when offline */}
      {isOffline && <OfflineBanner />}

      {/* Main content — scrollable, padded for bottom nav */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ paddingBottom: 'var(--bottom-nav-height)' }}
      >
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        items={visibleNavItems}
        currentPath={currentPath}
        syncState={syncState}
        onNavigate={onNavigate}
      />
    </div>
  );
}

// ─── Bottom Navigation ────────────────────────────────────────────────────────

function BottomNav({
  items,
  currentPath,
  syncState,
  onNavigate,
}: {
  items:       NavItem[];
  currentPath: string;
  syncState:   SyncState;
  onNavigate:  (href: string) => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-surface-border z-50"
      style={{ height: 'var(--bottom-nav-height)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around h-full px-1">
        {items.map(item => {
          const isActive = currentPath.startsWith(item.href);
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.href)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
              className={[
                'flex flex-col items-center justify-center gap-1',
                'flex-1 h-full relative',
                'touch-manipulation transition-colors duration-100',
                'focus-visible:outline-none focus-visible:bg-brand-pale',
                isActive ? 'text-brand' : 'text-content-muted',
              ].join(' ')}
            >
              {/* Active indicator */}
              {isActive && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-brand rounded-b-full"
                  aria-hidden="true"
                />
              )}

              {/* Badge */}
              {item.badge != null && item.badge > 0 && (
                <span
                  className="absolute top-2 right-1/4 bg-accent text-brand-darkest text-[9px] font-bold font-mono w-4 h-4 rounded-full flex items-center justify-center"
                  aria-hidden="true"
                >
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}

              <span className={['text-xl transition-transform duration-100', isActive ? 'scale-110' : ''].join(' ')}>
                {item.icon}
              </span>
              <span className="text-[10px] font-semibold tracking-wide uppercase">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Offline banner (used inside AppShell) ────────────────────────────────────

function OfflineBanner() {
  return (
    <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-1.5 flex items-center gap-2" role="alert">
      <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse-dot shrink-0" />
      <p className="text-[12px] text-yellow-800 font-medium">
        Offline — changes will sync when you reconnect
      </p>
    </div>
  );
}

// =============================================================================
// PAGE HEADER
//
// Sticky header for each page. Contains title, back button, and actions.
// Keeps consistent height (56px) so content never jumps.
// =============================================================================

export interface PageHeaderProps {
  title:       string;
  subtitle?:   string;
  onBack?:     () => void;
  actions?:    React.ReactNode;   // right-side action buttons
  syncState?:  SyncState;
  className?:  string;
}

export function PageHeader({
  title,
  subtitle,
  onBack,
  actions,
  syncState,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={[
        'sticky top-0 z-40 bg-surface-raised border-b border-surface-border',
        'flex items-center gap-3 px-4',
        'safe-top',
        className,
      ].join(' ')}
      style={{ height: 'var(--page-header-height)' }}
    >
      {/* Back button */}
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Go back"
          className="w-10 h-10 flex items-center justify-center -ml-2 text-content-secondary hover:text-content rounded-lg touch-manipulation"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M19 12H5M12 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {/* Title */}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-bold text-field-lg text-content truncate leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-field-xs text-content-muted truncate">{subtitle}</p>
        )}
      </div>

      {/* Sync indicator */}
      {syncState && syncState !== 'online' && (
        <SyncStatus state={syncState} quietMode className="shrink-0" />
      )}

      {/* Actions */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
}

// =============================================================================
// SECTION
//
// Consistent page section wrapper with optional header.
// =============================================================================

export function Section({
  title,
  action,
  children,
  className = '',
}: {
  title?:    string;
  action?:   React.ReactNode;
  children:  React.ReactNode;
  className?: string;
}) {
  return (
    <section className={['px-4', className].join(' ')}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 mb-3">
          {title && (
            <h2 className="font-display font-semibold text-field-sm text-content-secondary uppercase tracking-wider">
              {title}
            </h2>
          )}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
