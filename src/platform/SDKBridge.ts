// CrazyGames SDK bridge per blueprint.md §18.2.
//
// Production-shaped: if window.CrazyGames.SDK is present AND init() succeeded
// (i.e. we're really inside a CrazyGames iframe), every method routes to the
// real SDK. In any other case — script missing, init failed, running on
// localhost — we fall back to safe stubs.
//
// IMPORTANT: getSDK() returns the SDK reference only after init() has
// resolved successfully. Calling SDK methods before that window throws
// "CrazySDK is not initialized yet"; this module guards every call.

import { AudioBus } from '../audio/AudioBus';

export interface RewardedAdResult {
  success: boolean;
  reason?: string;
}

export interface UserInfo {
  username: string;
}

const STORAGE_PREFIX = 'nfr:';
const memoryStorage: Record<string, string> = Object.create(null);

function localStoreSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    memoryStorage[key] = value;
  }
}

function localStoreGet(key: string): string | null {
  try {
    return localStorage.getItem(key) ?? memoryStorage[key] ?? null;
  } catch {
    return memoryStorage[key] ?? null;
  }
}

// Minimal type for the CrazyGames SDK surface we actually touch. v3 SDK
// returns promises from gameplay/lifecycle methods even though the docs
// describe them as fire-and-forget — in 'disabled' environments (local
// dev, sandboxed iframes) those promises *reject* with GeneralError. We
// type them as possibly-promise so the bridge can swallow both sync throws
// and async rejections.
interface CrazyGamesAdAPI {
  requestAd(type: 'rewarded' | 'midgame'): Promise<void>;
}
interface CrazyGamesGameAPI {
  loadingStart(): void | Promise<void>;
  loadingStop(): void | Promise<void>;
  gameplayStart(): void | Promise<void>;
  gameplayStop(): void | Promise<void>;
  happytime(): void | Promise<void>;
}
interface CrazyGamesDataAPI {
  setItem(key: string, value: string): Promise<void> | void;
  getItem(key: string): Promise<string | null> | string | null;
}
interface CrazyGamesUserAPI {
  getUser(): Promise<{ username?: string } | null> | { username?: string } | null;
  addAuthListener?(fn: (user: { username?: string } | null) => void): void;
}
interface CrazyGamesSDK {
  init(): Promise<void>;
  ad: CrazyGamesAdAPI;
  game: CrazyGamesGameAPI;
  data?: CrazyGamesDataAPI;
  user?: CrazyGamesUserAPI;
  addEventListener?(event: string, fn: (...args: unknown[]) => void): void;
  // v3 SDK exposes the resolved environment after init(). 'disabled' means
  // the script loaded but the host won't accept gameplay/ad/data calls —
  // typically because we're running on localhost or an un-whitelisted domain.
  // Treated as "no SDK" so we fall back to localStorage + reward-success stubs.
  getEnvironment?(): string;
}

function rawSDK(): CrazyGamesSDK | null {
  if (typeof window === 'undefined') return null;
  const cg = (window as unknown as { CrazyGames?: { SDK?: CrazyGamesSDK } }).CrazyGames;
  return cg?.SDK ?? null;
}

class SDKBridgeImpl {
  private readyResolved = false;
  // Only flipped true if SDK.init() RESOLVED. If the SDK script loaded but
  // init() threw (no CG iframe, network blocked, etc.), this stays false and
  // every method below short-circuits to the local-dev fallback.
  private initOk = false;
  private cachedUsername: string | null = null;

  async init(): Promise<void> {
    const sdk = rawSDK();
    if (sdk) {
      try {
        // Bound the SDK handshake. On localhost / un-whitelisted domains the
        // SDK's parent-frame ping blocks for ~5s before resolving to
        // 'disabled', which strands the loading bar at 10%. Race a 2s
        // timeout so we drop into fallback mode quickly when not on
        // CrazyGames. Production iframe init resolves in well under 1s.
        const initTimeout = new Promise<'timeout'>(resolve => {
          setTimeout(() => resolve('timeout'), 2000);
        });
        const result = await Promise.race([
          sdk.init().then(() => 'ok' as const),
          initTimeout,
        ]);
        if (result === 'timeout') {
          // SDK didn't respond in time — fall back to stub mode. We don't
          // surface this as an error because it's expected off-platform.
          this.initOk = false;
          this.readyResolved = true;
          return;
        }
        // 'disabled' environment means the SDK refuses all gameplay/ad/data
        // calls (localhost, un-whitelisted domain, etc.). Treat as no-SDK so
        // we don't even try to call methods that will reject.
        let env: string | undefined;
        try {
          env = sdk.getEnvironment?.();
        } catch {
          env = undefined;
        }
        if (env && env !== 'disabled') {
          this.initOk = true;
        } else if (!env) {
          // Older SDKs may not expose getEnvironment; assume usable.
          this.initOk = true;
        }
        if (this.initOk) {
          // Wire ad-lifecycle to AudioBus so playback ducks while an ad runs.
          if (sdk.addEventListener) {
            try {
              sdk.addEventListener('adStarted', () => AudioBus.setPlatformMute(true));
              sdk.addEventListener('adFinished', () => AudioBus.setPlatformMute(false));
              sdk.addEventListener('adError', () => AudioBus.setPlatformMute(false));
            } catch {
              // Older SDK builds may not expose addEventListener; non-fatal.
            }
          }
          // Cache username for personalization. Best-effort; never blocks boot.
          if (sdk.user?.getUser) {
            try {
              const maybe = sdk.user.getUser();
              if (maybe && typeof (maybe as Promise<unknown>).then === 'function') {
                (maybe as Promise<{ username?: string } | null>)
                  .then(u => {
                    if (u?.username) this.cachedUsername = u.username;
                  })
                  .catch(() => {});
              } else if (maybe && typeof maybe === 'object' && 'username' in maybe) {
                const u = maybe as { username?: string };
                if (u.username) this.cachedUsername = u.username;
              }
            } catch {
              // Synchronous throw from getUser — non-fatal.
            }
          }
        }
      } catch {
        // SDK is present but init() rejected. Stay in stub mode.
        this.initOk = false;
      }
    }
    this.readyResolved = true;
  }

  // Returns the live SDK reference ONLY if init() succeeded. All callers
  // funnel through here so a half-loaded SDK can't throw mid-method.
  private get sdk(): CrazyGamesSDK | null {
    if (!this.initOk) return null;
    return rawSDK();
  }

  setMuted(muted: boolean): void {
    AudioBus.setPlatformMute(muted);
  }

  // Catches both synchronous throws and rejected-promise returns. CrazyGames
  // SDK v3 may return a Promise from lifecycle methods that rejects with
  // GeneralError when the SDK is in 'disabled' environment (dev / sandbox).
  // An unhandled rejection on those promises would otherwise crash the
  // async caller (BootScene.create).
  private safeCall(fn: (() => void | Promise<unknown>) | undefined): void {
    if (!fn) return;
    try {
      const r = fn();
      if (r && typeof (r as Promise<unknown>).then === 'function') {
        (r as Promise<unknown>).catch(() => {
          // SDK refused the call. Silenced; bridge already in fallback mode.
        });
      }
    } catch {
      // Synchronous throw — silenced for the same reason.
    }
  }

  loadingStart(): void {
    const sdk = this.sdk;
    this.safeCall(sdk ? () => sdk.game.loadingStart() : undefined);
  }

  loadingStop(): void {
    const sdk = this.sdk;
    this.safeCall(sdk ? () => sdk.game.loadingStop() : undefined);
  }

  gameplayStart(): void {
    const sdk = this.sdk;
    this.safeCall(sdk ? () => sdk.game.gameplayStart() : undefined);
  }

  gameplayStop(): void {
    const sdk = this.sdk;
    this.safeCall(sdk ? () => sdk.game.gameplayStop() : undefined);
  }

  async requestRewarded(): Promise<RewardedAdResult> {
    const sdk = this.sdk;
    if (!sdk) {
      // Dev fallback: assume reward granted so flows are testable locally.
      return { success: true };
    }
    try {
      await sdk.ad.requestAd('rewarded');
      return { success: true };
    } catch (e) {
      return { success: false, reason: e instanceof Error ? e.message : String(e) };
    }
  }

  async requestMidgame(): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return;
    try {
      await sdk.ad.requestAd('midgame');
    } catch {
      // Midgame ads are best-effort; never block gameplay on failure.
    }
  }

  happytime(): void {
    const sdk = this.sdk;
    this.safeCall(sdk ? () => sdk.game.happytime() : undefined);
  }

  async saveData(key: string, data: unknown): Promise<void> {
    const payload = JSON.stringify(data);
    const sdk = this.sdk;
    if (sdk?.data?.setItem) {
      try {
        await Promise.resolve(sdk.data.setItem(STORAGE_PREFIX + key, payload));
      } catch {
        // Cloud save failed; fall through to localStorage so we don't drop the write.
      }
    }
    localStoreSet(STORAGE_PREFIX + key, payload);
  }

  async loadData<T>(key: string): Promise<T | null> {
    const sdk = this.sdk;
    if (sdk?.data?.getItem) {
      try {
        const raw = await Promise.resolve(sdk.data.getItem(STORAGE_PREFIX + key));
        if (raw) return JSON.parse(raw) as T;
      } catch {
        // Cloud read failed; fall through to localStorage.
      }
    }
    try {
      const raw = localStoreGet(STORAGE_PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  getUser(): UserInfo {
    return { username: this.cachedUsername ?? 'Player' };
  }

  isReady(): boolean {
    return this.readyResolved;
  }

  // True iff we're really connected to the CrazyGames host (SDK script
  // loaded AND init() succeeded). Useful for callers that want to gate
  // backend features behind a real platform.
  isOnPlatform(): boolean {
    return this.initOk;
  }
}

export const SDKBridge = new SDKBridgeImpl();
