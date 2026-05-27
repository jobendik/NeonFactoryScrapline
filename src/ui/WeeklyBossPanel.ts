// Weekly Boss (Signal Hydra) — DOM-only battle implementation.
//
// Per the project constraint, NO Phaser graphics are rendered for this
// mode. The entire battle — boss, weak points, player, projectiles,
// telegraphs, HUD, end screens — is a tree of <div>s positioned with
// CSS percentages inside a fixed-size arena. A small fixed-timestep
// update loop driven by requestAnimationFrame advances positions and
// resolves collisions; CSS handles all visuals.
//
// Flow:
//   openWeeklyBossPanel(scene) → briefing modal
//     ENGAGE → battle overlay (5-minute timer, 3 boss phases)
//       Victory → WeeklyBossSystem.recordVictory + grantVictoryReward
//                  → end card with rewards + RETURN/RETRY
//       Defeat/Timer → end card with RETRY/RETURN
//
// Phase model (HP thresholds at 66% and 33%):
//   Phase 1 (100→67%): 2 weak points orbit slowly. Boss fires aimed bullets.
//   Phase 2 (67→34%):  3 weak points + radial burst attack every ~4s.
//   Phase 3 (33→0%):   4 weak points, burst + aimed bullets, faster ring.

import type Phaser from 'phaser';
import { Strings } from '../config/Strings';
import { UIOverlay, el, btn } from './overlay/UIOverlay';
import { saveSystem } from '../platform/SaveSystem';
import {
  WeeklyBossSystem,
  formatMs,
  formatCountdown,
} from '../systems/WeeklyBossSystem';
import {
  sfxUiClick,
  sfxShoot,
  sfxEnemyHit,
  sfxEnemyDeath,
  sfxPlayerHurt,
  sfxEnemyShoot,
  sfxExtractionSuccess,
  sfxRaidFailed,
} from '../audio/sfx';
import '../ui/styles/weekly-boss.css';

type Teardown = () => void;

// --- Tunables (kept local; the mode is self-contained) -------------------

const ARENA_W = 1100;        // px in design space
const ARENA_H = 620;
const RAID_DURATION_MS = 5 * 60 * 1000;

const BOSS_MAX_HP = 300;
const PLAYER_MAX_HP = 100;

const PLAYER_RADIUS = 13;
const PLAYER_SPEED = 320;             // px/sec
const PLAYER_FIRE_INTERVAL_MS = 220;
const PLAYER_BULLET_SPEED = 620;
const PLAYER_BULLET_RADIUS = 4;
const PLAYER_BULLET_DAMAGE = 5;
const PLAYER_IFRAMES_MS = 700;

const BOSS_CENTER_X_PCT = 50;
const BOSS_CENTER_Y_PCT = 32;
const BOSS_ORBIT_PX = 90;             // weak-point orbit radius around boss center
const WEAKPOINT_RADIUS = 19;

const BOSS_BULLET_SPEED = 240;
const BOSS_BULLET_RADIUS = 7;
const BOSS_BULLET_DAMAGE = 14;
const BOSS_AIMED_FIRE_INTERVAL_MS = 1400;
const BOSS_BURST_INTERVAL_MS = 4200;
const BOSS_BURST_TELEGRAPH_MS = 700;
const BOSS_BURST_COUNT = 14;

interface Vec2 { x: number; y: number; }

interface Bullet {
  pos: Vec2;
  vel: Vec2;
  radius: number;
  damage: number;
  fromPlayer: boolean;
  el: HTMLElement;
}

interface Weakpoint {
  angle: number;          // radians; orbits around boss center
  el: HTMLElement;
  alive: boolean;
  // local center in arena pixels (computed each frame)
  px: number;
  py: number;
}

// --- Public entry points --------------------------------------------------

export function openWeeklyBossPanel(scene: Phaser.Scene, onClosed?: () => void): Teardown {
  WeeklyBossSystem.ensureSaveShape();

  const panel = el('div', 'nfr-panel violet');
  panel.style.minWidth = '460px';
  panel.style.maxWidth = '560px';

  const title = el('h1', 'nfr-panel__title');
  title.textContent = Strings.weeklyBossTitle;
  panel.appendChild(title);

  const sub = el('div', 'wb-briefing__sub');
  sub.textContent = Strings.weeklyBossSubtitle;
  panel.appendChild(sub);

  const body = el('p', 'wb-briefing__body');
  body.textContent = Strings.weeklyBossBriefingBody;
  panel.appendChild(body);

  const stats = el('div', 'wb-briefing__stats');
  const best = WeeklyBossSystem.bestThisWeek();
  const bestText = best ? formatMs(best.killTimeMs) : Strings.weeklyBossBestNone;
  stats.appendChild(makeStatRow(Strings.weeklyBossBestThisWeekPrefix, bestText));
  stats.appendChild(makeStatRow(
    Strings.weeklyBossResetPrefix,
    formatCountdown(WeeklyBossSystem.msUntilWeeklyReset()),
  ));
  stats.appendChild(makeStatRow(
    Strings.weeklyBossTotalKillsPrefix,
    String(WeeklyBossSystem.totalKills()),
  ));
  panel.appendChild(stats);

  // Leaderboard.
  const lb = el('div', 'wb-briefing__lb');
  const lbTitle = el('div', 'wb-briefing__lb-title', Strings.weeklyBossLeaderboardTitle);
  lb.appendChild(lbTitle);
  const rows = el('div', 'wb-briefing__lb-rows');
  const top = WeeklyBossSystem.topEntries();
  if (top.length === 0) {
    const empty = el('div', 'wb-briefing__lb-empty', Strings.weeklyBossLeaderboardEmpty);
    rows.appendChild(empty);
  } else {
    const currentKey = WeeklyBossSystem.currentWeekKey();
    top.forEach((entry, idx) => {
      const row = el('div', 'wb-briefing__lb-row');
      if (entry.weekKey === currentKey) row.classList.add('is-current');
      row.appendChild(el('div', 'wb-briefing__lb-rank', `#${idx + 1}`));
      row.appendChild(el('div', 'wb-briefing__lb-week', entry.weekKey));
      row.appendChild(el('div', 'wb-briefing__lb-time', formatMs(entry.killTimeMs)));
      rows.appendChild(row);
    });
  }
  lb.appendChild(rows);
  panel.appendChild(lb);

  const actions = el('div', 'wb-briefing__actions');
  let dismiss: Teardown = () => undefined;
  const engageBtn = btn(Strings.weeklyBossEnter, 'gold', () => {
    sfxUiClick();
    dismiss();
    startBossBattle(scene, onClosed);
  });
  const closeBtn = btn(Strings.weeklyBossClose, 'cyan', () => {
    sfxUiClick();
    dismiss();
  }, { size: 'sm' });
  actions.appendChild(engageBtn);
  actions.appendChild(closeBtn);
  panel.appendChild(actions);

  dismiss = UIOverlay.mountModal(scene, panel, {
    dismissOnBackdrop: true,
    onDismiss: () => onClosed?.(),
  });
  return dismiss;
}

function makeStatRow(label: string, value: string): HTMLElement {
  const row = el('div');
  const lab = el('span');
  lab.textContent = label;
  const val = el('strong');
  val.textContent = value;
  row.appendChild(lab);
  row.appendChild(val);
  return row;
}

// --- Battle ----------------------------------------------------------------

function startBossBattle(scene: Phaser.Scene, onClosed?: () => void): void {
  // Pause Phaser scene input so canvas clicks under the overlay are inert.
  if (scene.input) scene.input.enabled = false;

  const root = el('div', 'wb-root');

  // ---- HUD --------------------------------------------------------------
  const hud = el('div', 'wb-hud');
  // Timer row
  const timerRow = el('div', 'wb-hud__row');
  const timerLabel = el('div', 'wb-hud__label', Strings.weeklyBossTimeLabel);
  const timerValue = el('div', 'wb-hud__value');
  timerValue.textContent = formatMs(RAID_DURATION_MS);
  timerRow.appendChild(timerLabel);
  timerRow.appendChild(timerValue);
  hud.appendChild(timerRow);
  // Boss HP row
  const bossRow = el('div', 'wb-hud__row');
  const bossLabel = el('div', 'wb-hud__label', Strings.weeklyBossHpLabel);
  const bossBar = el('div', 'wb-bar wb-bar--boss');
  const bossFill = el('div', 'wb-bar__fill');
  bossBar.appendChild(bossFill);
  bossRow.appendChild(bossLabel);
  bossRow.appendChild(bossBar);
  hud.appendChild(bossRow);
  // Player HP row
  const playerRow = el('div', 'wb-hud__row');
  const playerLabel = el('div', 'wb-hud__label', Strings.weeklyBossPlayerHpLabel);
  const playerBar = el('div', 'wb-bar wb-bar--player');
  const playerFill = el('div', 'wb-bar__fill');
  playerBar.appendChild(playerFill);
  playerRow.appendChild(playerLabel);
  playerRow.appendChild(playerBar);
  hud.appendChild(playerRow);
  root.appendChild(hud);

  // ---- Arena ------------------------------------------------------------
  const arena = el('div', 'wb-arena');
  arena.style.width = `${ARENA_W}px`;
  arena.style.height = `${ARENA_H}px`;
  root.appendChild(arena);

  // Hydra (boss body)
  const hydra = el('div', 'wb-hydra');
  hydra.dataset.phase = '1';
  hydra.appendChild(el('div', 'wb-hydra__ring'));
  hydra.appendChild(el('div', 'wb-hydra__ring wb-hydra__ring--inner'));
  hydra.appendChild(el('div', 'wb-hydra__core'));
  // Decorative tentacles (rendered, not collision).
  for (let i = 0; i < 6; i++) {
    const t = el('div', 'wb-hydra__tentacle');
    t.style.setProperty('--wb-angle', `${i * 60}deg`);
    hydra.appendChild(t);
  }
  hydra.style.left = `${BOSS_CENTER_X_PCT}%`;
  hydra.style.top = `${BOSS_CENTER_Y_PCT}%`;
  arena.appendChild(hydra);

  // Player
  const player = el('div', 'wb-player');
  player.appendChild(el('div', 'wb-player__body'));
  arena.appendChild(player);

  // Hint
  const hint = el('div', 'wb-hint', Strings.weeklyBossTutorialHint);
  arena.appendChild(hint);

  // ---- Mount overlay ----------------------------------------------------
  const dismissOverlay = UIOverlay.mountHud(scene, root);

  // Boss center in arena px.
  const bossCenter: Vec2 = {
    x: ARENA_W * BOSS_CENTER_X_PCT / 100,
    y: ARENA_H * BOSS_CENTER_Y_PCT / 100,
  };

  // Player state.
  const playerState = {
    pos: { x: ARENA_W * 0.5, y: ARENA_H * 0.82 } as Vec2,
    hp: PLAYER_MAX_HP,
    iframesUntil: 0,
    lastFireMs: 0,
  };

  // Boss state.
  const bossState = {
    hp: BOSS_MAX_HP,
    phase: 1 as 1 | 2 | 3,
    lastAimedFireMs: 0,
    nextBurstMs: BOSS_BURST_INTERVAL_MS, // first burst after this delay
    burstTelegraphUntil: 0,
    burstFireAt: 0,
    burstTelegraphEl: null as HTMLElement | null,
    ringSpinDeg: 0,
  };

  const weakpoints: Weakpoint[] = [];
  const bullets: Bullet[] = [];

  function spawnWeakpoints(count: number): void {
    // Tear down previous weak points.
    for (const wp of weakpoints) wp.el.remove();
    weakpoints.length = 0;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const e = el('div', 'wb-weakpoint');
      arena.appendChild(e);
      weakpoints.push({ angle, el: e, alive: true, px: 0, py: 0 });
    }
  }
  spawnWeakpoints(2);

  // Phase banner helper.
  function showPhaseBanner(label: string): void {
    const banner = el('div', 'wb-phase-banner', label);
    arena.appendChild(banner);
    window.setTimeout(() => banner.remove(), 1700);
  }
  showPhaseBanner(Strings.weeklyBossPhase1);

  // ---- Input ------------------------------------------------------------
  const keys = { up: false, down: false, left: false, right: false, fire: false };
  let aim: Vec2 = { x: bossCenter.x, y: bossCenter.y };
  let arenaRect: DOMRect = arena.getBoundingClientRect();
  const refreshRect = (): void => { arenaRect = arena.getBoundingClientRect(); };

  function setKey(code: string, value: boolean): boolean {
    switch (code) {
      case 'KeyW': case 'ArrowUp':    keys.up = value; return true;
      case 'KeyS': case 'ArrowDown':  keys.down = value; return true;
      case 'KeyA': case 'ArrowLeft':  keys.left = value; return true;
      case 'KeyD': case 'ArrowRight': keys.right = value; return true;
      case 'Space':                   keys.fire = value; return true;
      default: return false;
    }
  }
  const onKeyDown = (e: KeyboardEvent): void => {
    if (setKey(e.code, true)) e.preventDefault();
    if (e.code === 'Escape') endBattle('quit');
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (setKey(e.code, false)) e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent): void => {
    // Map screen → arena-local px.
    aim = {
      x: ((e.clientX - arenaRect.left) / arenaRect.width) * ARENA_W,
      y: ((e.clientY - arenaRect.top) / arenaRect.height) * ARENA_H,
    };
  };
  const onPointerDown = (e: PointerEvent): void => {
    onPointerMove(e);
    keys.fire = true;
  };
  const onPointerUp = (): void => { keys.fire = false; };

  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
  arena.addEventListener('pointermove', onPointerMove);
  arena.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('resize', refreshRect);
  // First-frame rect (the canvas may be letterboxed; we want CSS-pixel size).
  requestAnimationFrame(refreshRect);

  // ---- Update loop ------------------------------------------------------
  const startMs = performance.now();
  let lastFrameMs = startMs;
  let outcome: 'victory' | 'defeat' | 'timer' | 'quit' | null = null;
  let rafId = 0;

  function tick(nowMs: number): void {
    if (outcome) return;
    const dt = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
    lastFrameMs = nowMs;
    const elapsedMs = nowMs - startMs;
    const remainingMs = Math.max(0, RAID_DURATION_MS - elapsedMs);

    // Timer.
    timerValue.textContent = formatMs(remainingMs);
    timerValue.classList.toggle('is-warning', remainingMs < 60_000 && remainingMs >= 15_000);
    timerValue.classList.toggle('is-critical', remainingMs < 15_000);
    if (remainingMs <= 0) {
      endBattle('timer');
      return;
    }

    // -- Player movement
    let mx = 0, my = 0;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (mx !== 0 || my !== 0) {
      const inv = 1 / Math.hypot(mx, my);
      playerState.pos.x = clamp(playerState.pos.x + mx * inv * PLAYER_SPEED * dt, PLAYER_RADIUS, ARENA_W - PLAYER_RADIUS);
      playerState.pos.y = clamp(playerState.pos.y + my * inv * PLAYER_SPEED * dt, PLAYER_RADIUS, ARENA_H - PLAYER_RADIUS);
    }
    player.style.left = `${(playerState.pos.x / ARENA_W) * 100}%`;
    player.style.top = `${(playerState.pos.y / ARENA_H) * 100}%`;
    const iframesActive = nowMs < playerState.iframesUntil;
    player.classList.toggle('is-iframes', iframesActive);

    // -- Player firing
    if (keys.fire && nowMs - playerState.lastFireMs >= PLAYER_FIRE_INTERVAL_MS) {
      playerState.lastFireMs = nowMs;
      const dx = aim.x - playerState.pos.x;
      const dy = aim.y - playerState.pos.y;
      const len = Math.hypot(dx, dy) || 1;
      const vx = (dx / len) * PLAYER_BULLET_SPEED;
      const vy = (dy / len) * PLAYER_BULLET_SPEED;
      const b: Bullet = {
        pos: { x: playerState.pos.x, y: playerState.pos.y },
        vel: { x: vx, y: vy },
        radius: PLAYER_BULLET_RADIUS,
        damage: PLAYER_BULLET_DAMAGE,
        fromPlayer: true,
        el: el('div', 'wb-bullet'),
      };
      positionBullet(b);
      arena.appendChild(b.el);
      bullets.push(b);
      sfxShoot();
    }

    // -- Weakpoint orbit
    const orbitSpeed = 0.6 + (bossState.phase - 1) * 0.45; // rad/s, faster per phase
    for (const wp of weakpoints) {
      if (!wp.alive) continue;
      wp.angle += orbitSpeed * dt;
      wp.px = bossCenter.x + Math.cos(wp.angle) * BOSS_ORBIT_PX;
      wp.py = bossCenter.y + Math.sin(wp.angle) * BOSS_ORBIT_PX * 0.85;
      wp.el.style.left = `${(wp.px / ARENA_W) * 100}%`;
      wp.el.style.top = `${(wp.py / ARENA_H) * 100}%`;
    }

    // -- Boss attacks
    // Aimed shot (always, faster cadence in higher phases).
    const aimedInterval = BOSS_AIMED_FIRE_INTERVAL_MS / (1 + (bossState.phase - 1) * 0.35);
    if (nowMs - bossState.lastAimedFireMs >= aimedInterval) {
      bossState.lastAimedFireMs = nowMs;
      spawnBossBullet(bossCenter, playerState.pos);
      // In phase 3, double-shot.
      if (bossState.phase === 3) {
        const offset = { x: playerState.pos.x + 60, y: playerState.pos.y + 30 };
        spawnBossBullet(bossCenter, offset);
      }
    }
    // Radial burst (phase 2+).
    if (bossState.phase >= 2) {
      if (!bossState.burstTelegraphUntil && elapsedMs >= bossState.nextBurstMs) {
        // Begin telegraph.
        bossState.burstTelegraphUntil = nowMs + BOSS_BURST_TELEGRAPH_MS;
        bossState.burstFireAt = bossState.burstTelegraphUntil;
        const tg = el('div', 'wb-telegraph');
        tg.style.left = `${(bossCenter.x / ARENA_W) * 100}%`;
        tg.style.top = `${(bossCenter.y / ARENA_H) * 100}%`;
        tg.style.width = `${ARENA_W * 0.7}px`;
        tg.style.height = `${ARENA_W * 0.7}px`;
        bossState.burstTelegraphEl = tg;
        arena.appendChild(tg);
      }
      if (bossState.burstTelegraphUntil && nowMs >= bossState.burstFireAt) {
        // Fire ring.
        bossState.burstTelegraphEl?.remove();
        bossState.burstTelegraphEl = null;
        bossState.burstTelegraphUntil = 0;
        bossState.nextBurstMs = elapsedMs + BOSS_BURST_INTERVAL_MS;
        fireBurst(bossCenter, BOSS_BURST_COUNT);
      }
    }

    // -- Move bullets + collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.pos.x += b.vel.x * dt;
      b.pos.y += b.vel.y * dt;
      // Cull off-arena.
      if (b.pos.x < -20 || b.pos.x > ARENA_W + 20 || b.pos.y < -20 || b.pos.y > ARENA_H + 20) {
        b.el.remove();
        bullets.splice(i, 1);
        continue;
      }
      positionBullet(b);
      if (b.fromPlayer) {
        // Player bullet hits a live weakpoint?
        let hit = false;
        for (const wp of weakpoints) {
          if (!wp.alive) continue;
          const dx = wp.px - b.pos.x;
          const dy = wp.py - b.pos.y;
          if (dx * dx + dy * dy <= (WEAKPOINT_RADIUS + b.radius) ** 2) {
            damageBoss(b.damage);
            b.el.remove();
            bullets.splice(i, 1);
            hit = true;
            break;
          }
        }
        if (hit) continue;
      } else {
        // Boss bullet hits player?
        const dx = playerState.pos.x - b.pos.x;
        const dy = playerState.pos.y - b.pos.y;
        if (dx * dx + dy * dy <= (PLAYER_RADIUS + b.radius) ** 2) {
          b.el.remove();
          bullets.splice(i, 1);
          if (!iframesActive) damagePlayer(b.damage);
          continue;
        }
      }
    }

    // Update boss HP bar / phase transitions.
    const hpPct = Math.max(0, bossState.hp / BOSS_MAX_HP);
    bossFill.style.transform = `scaleX(${hpPct})`;
    if (bossState.phase === 1 && hpPct <= 0.66) advancePhase(2);
    else if (bossState.phase === 2 && hpPct <= 0.33) advancePhase(3);

    // Player HP bar.
    playerFill.style.transform = `scaleX(${Math.max(0, playerState.hp / PLAYER_MAX_HP)})`;

    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  function positionBullet(b: Bullet): void {
    b.el.style.left = `${(b.pos.x / ARENA_W) * 100}%`;
    b.el.style.top = `${(b.pos.y / ARENA_H) * 100}%`;
    if (!b.fromPlayer && !b.el.classList.contains('wb-bullet--boss')) {
      b.el.classList.add('wb-bullet--boss');
    }
  }

  function spawnBossBullet(from: Vec2, toward: Vec2): void {
    const dx = toward.x - from.x;
    const dy = toward.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const b: Bullet = {
      pos: { x: from.x, y: from.y },
      vel: { x: (dx / len) * BOSS_BULLET_SPEED, y: (dy / len) * BOSS_BULLET_SPEED },
      radius: BOSS_BULLET_RADIUS,
      damage: BOSS_BULLET_DAMAGE,
      fromPlayer: false,
      el: el('div', 'wb-bullet wb-bullet--boss'),
    };
    positionBullet(b);
    arena.appendChild(b.el);
    bullets.push(b);
    sfxEnemyShoot();
  }

  function fireBurst(from: Vec2, count: number): void {
    const offset = Math.random() * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const a = offset + (i / count) * Math.PI * 2;
      const target = { x: from.x + Math.cos(a) * 200, y: from.y + Math.sin(a) * 200 };
      spawnBossBullet(from, target);
    }
  }

  function damageBoss(amount: number): void {
    bossState.hp = Math.max(0, bossState.hp - amount);
    hydra.classList.add('is-hit');
    window.setTimeout(() => hydra.classList.remove('is-hit'), 110);
    sfxEnemyHit();
    if (bossState.hp <= 0) {
      // Kill remaining weakpoints visually then end.
      for (const wp of weakpoints) {
        if (wp.alive) {
          wp.alive = false;
          wp.el.classList.add('is-dying');
        }
      }
      sfxEnemyDeath();
      endBattle('victory');
    }
  }

  function damagePlayer(amount: number): void {
    playerState.hp = Math.max(0, playerState.hp - amount);
    playerState.iframesUntil = performance.now() + PLAYER_IFRAMES_MS;
    player.classList.add('is-hit');
    window.setTimeout(() => player.classList.remove('is-hit'), 200);
    sfxPlayerHurt();
    if (playerState.hp <= 0) endBattle('defeat');
  }

  function advancePhase(p: 2 | 3): void {
    bossState.phase = p;
    hydra.dataset.phase = String(p);
    spawnWeakpoints(p === 2 ? 3 : 4);
    showPhaseBanner(p === 2 ? Strings.weeklyBossPhase2 : Strings.weeklyBossPhase3);
    // Reset burst timer so the new phase starts with a beat of safety.
    const elapsedMs = performance.now() - startMs;
    bossState.nextBurstMs = elapsedMs + BOSS_BURST_INTERVAL_MS * 0.5;
    bossState.burstTelegraphEl?.remove();
    bossState.burstTelegraphEl = null;
    bossState.burstTelegraphUntil = 0;
  }

  function teardown(): void {
    cancelAnimationFrame(rafId);
    window.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('keyup', onKeyUp, true);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('resize', refreshRect);
    // Restore Phaser scene input.
    if (scene.input) scene.input.enabled = true;
  }

  function endBattle(reason: 'victory' | 'defeat' | 'timer' | 'quit'): void {
    if (outcome) return;
    outcome = reason;
    cancelAnimationFrame(rafId);

    if (reason === 'quit') {
      teardown();
      dismissOverlay();
      onClosed?.();
      return;
    }

    const elapsedMs = performance.now() - startMs;
    const killTimeMs = Math.min(elapsedMs, RAID_DURATION_MS);
    const phasesCleared = reason === 'victory' ? 3 : (bossState.phase - 1);
    const timeRemainingMs = Math.max(0, RAID_DURATION_MS - elapsedMs);

    let isNewBest = false;
    let reward: { cores: number; shards: number } | null = null;
    if (reason === 'victory') {
      isNewBest = WeeklyBossSystem.recordVictory(killTimeMs);
      reward = WeeklyBossSystem.grantVictoryReward({ phasesCleared, timeRemainingMs });
      void saveSystem.persist();
      sfxExtractionSuccess();
    } else {
      sfxRaidFailed();
    }

    showEndCard(reason, killTimeMs, isNewBest, reward);
  }

  function showEndCard(
    reason: 'victory' | 'defeat' | 'timer',
    killTimeMs: number,
    isNewBest: boolean,
    reward: { cores: number; shards: number } | null,
  ): void {
    const card = el('div', `wb-end wb-end--${reason === 'victory' ? 'victory' : 'defeat'}`);
    const title = el('h2', 'wb-end__title');
    title.textContent =
      reason === 'victory' ? Strings.weeklyBossVictoryTitle :
      reason === 'timer'   ? Strings.weeklyBossTimeUpTitle :
                             Strings.weeklyBossDefeatTitle;
    card.appendChild(title);

    const timeRow = el('div', 'wb-end__time');
    timeRow.textContent = `${Strings.weeklyBossKillTimePrefix}${formatMs(killTimeMs)}`;
    card.appendChild(timeRow);

    if (isNewBest) {
      card.appendChild(el('div', 'wb-end__pb', Strings.weeklyBossNewBest));
    }

    if (reward) {
      const rewards = el('div', 'wb-end__rewards');
      const coresRow = el('div', 'wb-end__reward');
      coresRow.innerHTML = `<span class="num">+${reward.cores}</span>${Strings.weeklyBossRewardCoresSuffix}`;
      const shardsRow = el('div', 'wb-end__reward');
      shardsRow.innerHTML = `<span class="num">+${reward.shards}</span>${Strings.weeklyBossRewardShardsSuffix}`;
      rewards.appendChild(coresRow);
      rewards.appendChild(shardsRow);
      card.appendChild(rewards);
    }

    const actions = el('div', 'wb-end__actions');
    actions.appendChild(btn(Strings.weeklyBossReturn, 'cyan', () => {
      sfxUiClick();
      teardown();
      dismissOverlay();
      onClosed?.();
    }, { size: 'sm' }));
    actions.appendChild(btn(Strings.weeklyBossRetry, 'gold', () => {
      sfxUiClick();
      teardown();
      dismissOverlay();
      // Tiny delay so the dismiss animation isn't fighting with the re-mount.
      window.setTimeout(() => startBossBattle(scene, onClosed), 60);
    }, { size: 'sm' }));
    card.appendChild(actions);

    arena.appendChild(card);
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
