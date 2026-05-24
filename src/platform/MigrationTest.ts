import { saveSystem, createDefaultSave } from './SaveSystem';

// Dev-only migration test. Exposed on window as `__migrationTest()`.
// Builds a synthetic v0 save (no `version` field, pre-versioning shape),
// drops it into localStorage, reloads through saveSystem, and reports
// the final shape. Useful for verifying the v0 → v1 → ... → vN chain
// works without losing critical fields.
//
// Not advertised in the UI. Open dev tools, run `window.__migrationTest()`
// to see the trace.

export function installMigrationTest(): void {
  if (typeof window === 'undefined') return;
  (window as unknown as { __migrationTest?: () => void }).__migrationTest = () => {
    // Snapshot the current save so we can restore after the test runs.
    const previous = localStorage.getItem('nfr:save');
    const v0 = {
      // No `version` field — emulates a v0 save (pre-history). Per the
      // existing migrate() chain, v0 saves are discarded and replaced
      // with a fresh save. We still want to confirm that path runs
      // without throwing.
      scrap: 999,
      cores: 5,
      tutorialDone: true,
    };
    localStorage.setItem('nfr:save', JSON.stringify(v0));
    void saveSystem.load().then(() => {
      const after = saveSystem.get();
      const expectedDefault = createDefaultSave();
      console.group('[__migrationTest] v0 → vCURRENT chain');
      console.log('Loaded version:', after.version, '(expected:', expectedDefault.version, ')');
      console.log('Resulting save (should match default — v0 is discarded):', after);
      console.log('Default save for comparison:', expectedDefault);
      // Sanity: a v0 save is intentionally discarded; final state should
      // be a fresh default. Verify a few invariants:
      const ok =
        after.version === expectedDefault.version &&
        after.scrap === expectedDefault.scrap &&
        after.tutorialDone === false &&
        Array.isArray(after.unlockedOperators) &&
        typeof after.adState === 'object' &&
        typeof after.settings === 'object';
      console.log('All invariants:', ok ? 'OK' : 'FAILED');
      console.groupEnd();

      // Restore the previous save so the test doesn't clobber real progress.
      if (previous !== null) localStorage.setItem('nfr:save', previous);
      else localStorage.removeItem('nfr:save');
      void saveSystem.load();
    });
  };
}
