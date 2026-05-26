// Analytics — routes through the CrazyGames SDK analytics API when present
// so launch isn't blind. The blueprint §25 lists every event; all call sites
// were already plumbed in M0-M25 — this module is the delivery layer.
//
// When the SDK is not available (local dev), events go to console.debug so
// developers can see the funnel firing during testing without a network
// dependency. Production builds with the SDK loaded send events to
// CrazyGames' dashboard.
//
// Playbook §16.5 versioned metrics: every event auto-injects `v` (build
// version) and `tSec` (seconds since page load). Don't compare metric
// shifts across builds without filtering by `v`.

import { BUILD_VERSION, SESSION_START_MS } from './BuildInfo';
import { SDKBridge } from './SDKBridge';

interface CrazyGamesAnalyticsAPI {
  // v3 SDK methods may return a Promise that rejects in 'disabled' env
  // (localhost / un-whitelisted domain). We treat the return as possibly-promise
  // so the wrapper can swallow both sync throws and async rejections.
  trackEvent?(name: string, props?: Record<string, unknown>): void | Promise<unknown>;
  // The SDK historically also accepts a single 'event' object.
  event?(name: string, props?: Record<string, unknown>): void | Promise<unknown>;
}

interface CrazyGamesSDKWithAnalytics {
  analytics?: CrazyGamesAnalyticsAPI;
}

function getAnalyticsAPI(): CrazyGamesAnalyticsAPI | null {
  if (typeof window === 'undefined') return null;
  // Only attempt SDK access when we know the SDK is connected and usable.
  // Accessing SDK.analytics before init() completes causes the SDK to log
  // a console warning even when our try/catch suppresses the throw.
  if (!SDKBridge.isOnPlatform()) return null;
  try {
    const cg = (window as unknown as { CrazyGames?: { SDK?: CrazyGamesSDKWithAnalytics } })
      .CrazyGames;
    return cg?.SDK?.analytics ?? null;
  } catch {
    // Swallow any remaining throw (e.g. SDK present but analytics unset).
    return null;
  }
}

// Privacy: never send PII. The blueprint event list (§25.1) is all
// gameplay-state derived — no usernames, no IP, no device fingerprints.
// Numeric counters and short string ids only.
function sanitize(props?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.length > 64) continue;
    if (typeof v === 'number' && !Number.isFinite(v)) continue;
    out[k] = v;
  }
  return out;
}

// Swallow both sync throws and async rejections from the SDK. In 'disabled'
// environments the SDK rejects every call with GeneralError('sdkDisabled');
// without this guard the dangling rejected promise would surface as an
// unhandled rejection attributed to whatever async caller invoked us.
function safeInvoke(fn: () => void | Promise<unknown>): boolean {
  try {
    const r = fn();
    if (r && typeof (r as Promise<unknown>).then === 'function') {
      (r as Promise<unknown>).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

// De-dupe storm protection: a single bad render frame can throw dozens of
// times per second. Hash on (message, first line of stack) so we send the
// first occurrence and silently count the rest in dev only.
const errorSeen = new Set<string>();
const ERROR_DEDUPE_CAP = 40;

function errorKey(message: string, stack: string | undefined): string {
  const firstStackLine = (stack ?? '').split('\n')[1] ?? '';
  return `${message}::${firstStackLine}`.slice(0, 200);
}

// Seconds since module load. Short property name (`tSec`) so the
// analytics row stays under the SDK's per-property size budget. Computed
// fresh on each track() call so the dashboard can render "events vs.
// time-in-session" without a join.
function sessionSeconds(): number {
  if (typeof performance !== 'undefined') {
    return Math.round((performance.now() - SESSION_START_MS) / 1000);
  }
  return Math.round((Date.now() - SESSION_START_MS) / 1000);
}

// Inject version + session-time tags onto every outbound event so
// A/B-style comparisons across deploys actually work. Caller-supplied
// `v` and `tSec` are preserved if present (rare, but lets one-off events
// override the auto value).
function withMetaTags(props?: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { v: BUILD_VERSION, tSec: sessionSeconds() };
  if (props) {
    for (const [k, v] of Object.entries(props)) out[k] = v;
  }
  return out;
}

export const Analytics = {
  track(event: string, props?: Record<string, unknown>): void {
    const cleaned = sanitize(withMetaTags(props));
    const api = getAnalyticsAPI();
    if (api?.trackEvent && safeInvoke(() => api.trackEvent!(event, cleaned))) return;
    if (api?.event && safeInvoke(() => api.event!(event, cleaned))) return;
    // Dev fallback. console.debug is non-noisy by default in browser DevTools.
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[analytics]', event, cleaned ?? '');
    }
  },

  // Crash-rate visibility per playbook §10.7. Sends one event per unique
  // (message, top stack line) pair so a runaway error loop doesn't fill
  // the analytics bus. Source/lineno/colno are sent when available so the
  // dashboard can group by file too.
  trackError(
    source: 'window' | 'unhandledrejection' | 'caught',
    err: unknown,
    extra?: { filename?: string; lineno?: number; colno?: number; scene?: string },
  ): void {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
        ? err
        : (() => {
            try {
              return JSON.stringify(err);
            } catch {
              return String(err);
            }
          })();
    const stack = err instanceof Error ? err.stack : undefined;
    const key = errorKey(message, stack);
    if (errorSeen.has(key)) return;
    if (errorSeen.size >= ERROR_DEDUPE_CAP) return;
    errorSeen.add(key);
    Analytics.track('client_error', {
      source,
      message: message.slice(0, 200),
      // Top stack frame only — full stack is too large for analytics props
      // and the dashboard groups well on just the throw site.
      topFrame: (stack ?? '').split('\n')[1]?.trim().slice(0, 180) ?? '',
      filename: extra?.filename,
      lineno: extra?.lineno,
      colno: extra?.colno,
      scene: extra?.scene,
    });
  },
};
