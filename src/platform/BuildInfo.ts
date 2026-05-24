// Build-version tag attached to every analytics event so before/after
// comparisons across deploys are meaningful (playbook §16.5).
//
// Bump alongside package.json on each release. If we ever wire Vite's
// `define` to inject __APP_VERSION__ from package.json at build time,
// swap this constant for that — every callsite reads through here
// already.

export const BUILD_VERSION = '0.1.0';

// Module-load timestamp so analytics callers don't each need their own
// "started" clock. ESM evaluation happens once per page, so this is the
// canonical "session start" reference.
export const SESSION_START_MS =
  typeof performance !== 'undefined' ? performance.now() : Date.now();
