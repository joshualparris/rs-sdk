import { runScript } from '../../sdk/runner';
import { appendFileSync, mkdirSync, writeFileSync } from 'fs';

export type Ctx = { bot: any; sdk: any; dir: string };
export type Quest = { name: string; run: (c: Ctx) => Promise<boolean> };

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
export const has = (sdk: any, re: RegExp) => !!sdk.findInventoryItem(re);
export const count = (sdk: any, re: RegExp) =>
  (sdk.getState()?.inventory ?? []).filter((i: any) => re.test(i.name)).reduce((a: number, i: any) => a + (i.count ?? 1), 0);
export const xp = (sdk: any, skill: string) => sdk.getSkillXp(skill) ?? 0;
export const lvl = (sdk: any) => sdk.getState()?.player?.level ?? 0;
export const log = (c: Ctx, m: string) => { console.log(m); appendFileSync(`${c.dir}/lab_log.md`, `- ${new Date().toISOString()} ${m}\n`); };

export async function waitInv(sdk: any, re: RegExp, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (has(sdk, re)) return true; await sleep(300); }
  return false;
}

export async function waitCond(pred: () => boolean, ms: number, interval = 300) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (pred()) return true; await sleep(interval); }
  return pred();
}

// Click through a dialog, choosing the first option matching `want` (in `want` priority order), else "continue".
export async function chat({ sdk }: Ctx, want: RegExp[] = [], max = 100) {
  let closed = 0;
  for (let i = 0; i < max; i++) {
    const d = sdk.getState()?.dialog;
    if (!d?.isOpen) {
      if (++closed >= 5) return;
      await sleep(250);
      continue;
    }
    closed = 0;
    let opt: any;
    for (const w of want) {
      opt = d.options.find((o: any) => w.test(o.text));
      if (opt) break;
    }
    await sdk.sendClickDialog(opt ? opt.index : 0);
    await sleep(350);
  }
}

export async function openNearbyDoors(c: Ctx, nearX?: number, nearZ?: number, limit = 3) {
  const me = c.sdk.getState()?.player ?? { worldX: 0, worldZ: 0 };
  const tx = nearX ?? me.worldX, tz = nearZ ?? me.worldZ;
  const doors = (c.sdk.getState()?.nearbyLocs ?? [])
    .filter((l: any) => /door|gate/i.test(l.name) && (l.options ?? []).some((o: string) => /^open$/i.test(o)) && !(l.x === 3108 && l.z === 3353))
    .sort((a: any, b: any) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz));
  for (const d of doors.slice(0, limit)) {
    await c.bot.interactLoc(d, /^open$/i);
    await sleep(1000);
  }
}

export async function talk(c: Ctx, npc: RegExp, want: RegExp[] = []) {
  if (c.sdk.getState()?.dialog?.isOpen) await chat(c, want);
  let r = await c.bot.talkTo(npc);
  if (!r.success) {
    const target = c.sdk.findNearbyNpc(npc);
    await openNearbyDoors(c, target?.x, target?.z, 3);
    r = await c.bot.talkTo(npc);
  }
  if (!r.success) { log(c, `talkTo ${npc} failed: ${r.message ?? r.reason}`); return false; }
  await chat(c, want);
  return true;
}

// Climb Lumbridge Castle south spiral staircase at (3204,3207), landing tile (3205,3209).
export async function lumbridgeStairs(c: Ctx, targetLevel: 0 | 1 | 2): Promise<boolean> {
  const { bot, sdk } = c;
  for (let attempt = 0; attempt < 6 && lvl(sdk) !== targetLevel; attempt++) {
    const cur = lvl(sdk);
    const dir = cur < targetLevel ? /climb-?up/i : /climb-?down/i;
    const tiles: [number, number][] = [[3205, 3209], [3206, 3208], [3205, 3210]];
    for (const [x, z] of tiles) {
      if (lvl(sdk) !== cur) break;
      const w = await bot.walkTo(x, z, 1);
      if (!w?.success) {
        await openNearbyDoors(c, x, z, 2);
        await bot.walkTo(x, z, 1);
      }
      const stairs = (sdk.getState()?.nearbyLocs ?? [])
        .filter((l: any) => /stair/i.test(l.name) && Math.hypot(l.x - 3204, l.z - 3207) <= 3)[0] ?? /^staircase$/i;
      const r = await bot.interactLoc(stairs, dir);
      log(c, `lumbridgeStairs L${cur}->L${targetLevel} from (${x},${z}) -> ${JSON.stringify(r)}`);
      if (await waitCond(() => lvl(sdk) !== cur, 8000, 400)) break;
    }
  }
  return lvl(sdk) === targetLevel;
}

// Climb Juliet's house stairs at (3156,3435): bottom landing (3159,3435), top landing (3155,3435).
// Note: Juliet's front door at (3160,3440) is a diagonal door (shape 9), so use sdk.sendWalk across it.
export async function julietStairs(c: Ctx, targetLevel: 0 | 1): Promise<boolean> {
  const { bot, sdk } = c;
  if (targetLevel === 1) {
    if (lvl(sdk) === 0) {
      const p = sdk.getState()?.player;
      if (!p || p.worldX > 3161 || p.worldZ > 3439) {
        await bot.walkTo(3162, 3441, 2);
      }
      for (let i = 0; i < 4 && lvl(sdk) !== 1; i++) {
        const d = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3160, l.z - 3440) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
        if (d) { await bot.interactLoc(d, /^open$/i); await sleep(900); }
        await sdk.sendWalk(3159, 3435, true);
        await sleep(1600);
        await bot.interactLoc(/^staircase$/i, /climb-?up/i);
        await waitCond(() => lvl(sdk) === 1, 6000, 400);
      }
    }
    return lvl(sdk) === 1;
  }
  for (let i = 0; i < 4 && lvl(sdk) !== 0; i++) {
    const w = await bot.walkTo(3155, 3435, 1);
    if (!w?.success) { await openNearbyDoors(c, 3155, 3435, 2); await bot.walkTo(3155, 3435, 1); }
    await bot.interactLoc(/^staircase$/i, /climb-?down/i);
    await waitCond(() => lvl(sdk) === 0, 6000, 400);
  }
  for (let i = 0; i < 3; i++) {
    const p = sdk.getState()?.player;
    if (!p || p.level !== 0 || p.worldX < 3148 || p.worldX > 3164 || p.worldZ < 3426 || p.worldZ > 3440) break;
    await sdk.sendWalk(3160, 3439, true);
    await sleep(1200);
    const d = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3160, l.z - 3440) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d) { await bot.interactLoc(d, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3163, 3441, true);
    await sleep(1400);
  }
  return lvl(sdk) === 0;
}

export async function exitWizardsTowerGround(c: Ctx) {
  const { bot, sdk } = c;
  for (let i = 0; i < 4; i++) {
    const p = sdk.getState()?.player;
    if (!p || p.level !== 0 || p.worldX < 3102 || p.worldX > 3112 || p.worldZ < 3155 || p.worldZ > 3166) return;
    const d1 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3107, l.z - 3162) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d1) { await bot.interactLoc(d1, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3108, 3165, true);
    await sleep(1400);
    const d2 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3109, l.z - 3166) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d2) { await bot.interactLoc(d2, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3109, 3168, true);
    await sleep(1400);
  }
}

// Enter (down=true) or exit (down=false) the Wizards' Tower basement (cellar z > 9000).
export async function wizardsTowerBasement(c: Ctx, down: boolean): Promise<boolean> {
  const { bot, sdk } = c;
  const inCellar = () => (sdk.getState()?.player?.worldZ ?? 0) > 9000;
  if (down === inCellar()) return true;
  if (!down && inCellar()) {
    for (let i = 0; i < 4 && inCellar(); i++) {
      const w = await bot.walkTo(3104, 9576, 1);
      if (!w?.success) {
        await openNearbyDoors(c, 3108, 9570, 2);
        await bot.walkTo(3104, 9576, 1);
      }
      await bot.interactLoc(/ladder/i, /climb-?up/i);
      await waitCond(() => !inCellar(), 8000, 400);
    }
    if (!inCellar()) await exitWizardsTowerGround(c);
    return !inCellar();
  }
  if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
  await bot.walkTo(3109, 3168, 2);
  for (let i = 0; i < 4 && !inCellar(); i++) {
    const d2 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3109, l.z - 3166) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d2) { await bot.interactLoc(d2, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3108, 3164, true);
    await sleep(1400);
    const d1 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3107, l.z - 3162) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d1) { await bot.interactLoc(d1, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3105, 3162, true);
    await sleep(1400);
    const r = await bot.interactLoc(/ladder/i, /climb-?down/i);
    log(c, `wizardsTower climb-down -> ${JSON.stringify(r)}`);
    await waitCond(() => inCellar(), 8000, 400);
  }
  return inCellar();
}

export async function walkWaypoints(c: Ctx, pts: readonly (readonly [number, number])[], tol = 3): Promise<boolean> {
  const { bot, sdk } = c;
  await exitWizardsTowerGround(c);
  for (const [x, z] of pts) {
    for (let a = 0; a < 3; a++) {
      const r = await bot.walkTo(x, z, tol);
      const p = sdk.getState()?.player;
      if (p && Math.hypot(p.worldX - x, p.worldZ - z) <= tol + 3) break;
      if (!r?.success) {
        await openNearbyDoors(c, undefined, undefined, 2);
        await openNearbyDoors(c, x, z, 2);
      }
      await sleep(500);
    }
  }
  const [lx, lz] = pts[pts.length - 1];
  const p = sdk.getState()?.player;
  return !!p && Math.hypot(p.worldX - lx, p.worldZ - lz) <= tol + 4;
}

// Safe route from Lumbridge/Draynor to Varrock via the East Gate (avoids Dark Wizards at 3227,3369 and Draynor Manor).
export async function walkToVarrock(c: Ctx, destX = 3253, destZ = 3398): Promise<boolean> {
  const { sdk } = c;
  if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
  if ((sdk.getState()?.player?.worldZ ?? 0) > 9000) await wizardsTowerBasement(c, false);
  const p = sdk.getState()?.player;
  const wps: [number, number][] = [];
  if (p && p.worldZ >= 3470 && p.worldZ < 3510 && p.worldX >= 3195 && p.worldX <= 3230 && destZ < 3470) {
    wps.push([3212, 3465]);
  }
  if (!p || p.worldZ < 3380) {
    if (!p || p.worldZ < 3350 || p.worldX < 3250) {
      if (p && p.worldX < 3180) wps.push([3222, 3219]);
      wps.push([3260, 3260]);
    }
    wps.push([3285, 3365]);
    if (destZ >= 3380) wps.push([3273, 3428]);
  } else if (destZ < 3380) {
    wps.push([3273, 3428], [3285, 3365]);
  }
  wps.push([destX, destZ]);
  return walkWaypoints(c, wps, 2);
}

export async function walkFromVarrockToLumbridge(c: Ctx, destX = 3222, destZ = 3219): Promise<boolean> {
  const { sdk } = c;
  const p = sdk.getState()?.player;
  const wps: [number, number][] = [];
  if (p && p.worldZ >= 3470 && p.worldZ < 3510 && p.worldX >= 3195 && p.worldX <= 3230) {
    wps.push([3212, 3465]);
  }
  if (p && p.worldZ >= 3350 && p.worldZ < 9000) {
    wps.push([3273, 3428], [3285, 3365], [3260, 3260]);
  }
  wps.push([destX, destZ]);
  return walkWaypoints(c, wps, 2);
}

export async function pickupWithWait(c: Ctx, x: number, z: number, item: RegExp, waitSec = 25): Promise<boolean> {
  const { bot, sdk } = c;
  if (has(sdk, item)) return true;
  await bot.walkTo(x, z, 2);
  for (let i = 0; i < waitSec; i++) {
    const g = (sdk.getState()?.groundItems ?? []).find((it: any) => item.test(it.name));
    if (g) {
      const r = await bot.pickupItem(g);
      if (!r?.success) await openNearbyDoors(c, g.x, g.z, 2);
      if (await waitInv(sdk, item, 5000)) return true;
    }
    await sleep(1000);
  }
  return has(sdk, item);
}

// Everything we used to ask Josh to paste, written to one file.
export function snapshot(c: Ctx, quest: string, stepName: string, err?: any) {
  const { sdk } = c;
  const s = sdk.getState() ?? {};
  const slim = (l: any) => ({ n: l.name, x: l.x, z: l.z, id: l.id, o: l.options });
  const snap: any = {
    quest, step: stepName, time: new Date().toISOString(), error: err ? String(err?.stack ?? err) : undefined,
    player: s.player,
    skills: s.skills,
    inventory: (s.inventory ?? []).map((i: any) => `${i.name}${i.count > 1 ? ` x${i.count}` : ''}`),
    locs: (s.nearbyLocs ?? []).filter((l: any) => !/wheat/i.test(l.name)).slice(0, 60).map(slim),
    npcs: (s.nearbyNpcs ?? []).slice(0, 30).map((n: any) => ({ n: n.name, id: n.id, idx: n.index, x: n.x, z: n.z, o: n.options })),
    ground: s.groundItems,
    dialog: s.dialog,
    interface: s.interface,
    modalOpen: s.modalOpen,
    modalInterface: s.modalInterface,
    messages: (s.gameMessages ?? []).slice(-15),
    opFeedback: s.opFeedback,
  };
  try { snap.chat = sdk.getChat({ limit: 15 }); } catch (e) { snap.chat = String(e); }
  mkdirSync(`${c.dir}/failures`, { recursive: true });
  const f = `${c.dir}/failures/${quest.replace(/\W+/g, '-')}-${stepName.replace(/\W+/g, '-')}-${Date.now()}.json`;
  writeFileSync(f, JSON.stringify(snap, null, 1));
  console.log(`SNAPSHOT: ${f}`);
}

// Run one named step; on failure, snapshot and return false.
export async function step(c: Ctx, quest: string, name: string, fn: () => Promise<boolean>) {
  log(c, `STEP ${name}`);
  let ok = false, err: any;
  try { ok = await fn(); } catch (e) { err = e; }
  if (!ok) { log(c, `STEP FAILED ${name}`); snapshot(c, quest, name, err); }
  return ok;
}

export async function runQuests(dir: string, quests: Quest[]) {
  await runScript(async ({ bot, sdk }: any) => {
    const c: Ctx = { bot, sdk, dir };
    await bot.skipTutorial();
    if (sdk.getState()?.modalOpen || sdk.getState()?.interface?.isOpen) await bot.closeInterface();
    for (const q of quests) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        log(c, `START ${q.name} (attempt ${attempt})`);
        let ok = false;
        try { ok = await q.run(c); } catch (e: any) { log(c, `ERROR ${q.name}: ${e?.message ?? e}`); snapshot(c, q.name, 'exception', e); }
        if (sdk.getState()?.modalOpen || sdk.getState()?.interface?.isOpen) await bot.closeInterface();
        if (ok) { log(c, `DONE ${q.name}`); break; }
        await bot.dismissBlockingUI();
      }
    }
  }, { timeout: 45 * 60_000 });
}

// Empty the inventory into the Draynor bank, keeping only items matching `keep`. Equipment stays on.
export async function bankJunk(c: Ctx, keep: RegExp = /^(coins|shears|wool|ball of wool)$/i) {
  const { bot, sdk } = c;
  const junk = () => (sdk.getState()?.inventory ?? []).filter((i: any) => !keep.test(i.name));
  if (junk().length === 0) return true;
  if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
  await exitWizardsTowerGround(c);
  const p = sdk.getState()?.player;
  if (p && p.worldZ > 3350 && p.worldZ < 9000 && p.worldX > 3130) {
    await walkFromVarrockToLumbridge(c, 3092, 3243);
  }
  await bot.walkTo(3092, 3243);
  for (let round = 0; round < 6 && junk().length > 0; round++) {
    if (!sdk.isBankOpen()) {
      const r = await bot.openBank();
      log(c, `openBank -> ${JSON.stringify(r)}`);
      if (!r?.success) { await sleep(1000); continue; }
      await sleep(600);
    }
    for (const it of junk()) {
      if (!sdk.isBankOpen()) break;
      await sdk.sendBankDeposit(it.slot, it.count ?? 1);
      await sleep(450);
    }
  }
  if (sdk.isBankOpen()) await bot.closeBank();
  const left = junk().map((i: any) => i.name);
  if (left.length) log(c, `bank: still holding ${left.join(', ')}`);
  return left.length === 0;
}

export async function withdrawFromDraynorBank(c: Ctx, patterns: RegExp[]) {
  const { bot, sdk } = c;
  const missing = () => patterns.filter(p => !has(sdk, p) && !(sdk.getState()?.equipment ?? []).some((e: any) => p.test(e.name)));
  if (missing().length === 0) return;
  if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
  await exitWizardsTowerGround(c);
  const p = sdk.getState()?.player;
  if (p && p.worldZ > 3350 && p.worldZ < 9000 && p.worldX > 3130) {
    await walkFromVarrockToLumbridge(c, 3092, 3243);
  }
  await bot.walkTo(3092, 3243, 2);
  for (let round = 0; round < 3 && missing().length > 0; round++) {
    if (!sdk.isBankOpen()) {
      const r = await bot.openBank();
      if (!r?.success) { await sleep(800); continue; }
      await sleep(600);
    }
    for (const pat of missing()) {
      const bi = sdk.findBankItem(pat);
      if (bi) {
        await sdk.sendBankWithdraw(bi.slot, bi.count ?? 1);
        await sleep(450);
      }
    }
    break;
  }
  if (sdk.isBankOpen()) await bot.closeBank();
}

export async function combineItems(c: Ctx, a: RegExp, b: RegExp, result: RegExp, waitMs = 3000): Promise<boolean> {
  const { sdk } = c;
  if (has(sdk, result)) return true;
  for (let i = 0; i < 3 && !has(sdk, result); i++) {
    const ia = sdk.findInventoryItem(a);
    const ib = sdk.findInventoryItem(b);
    if (!ia || !ib) return false;
    await sdk.sendUseItemOnItem(ia.slot, ib.slot);
    if (await waitInv(sdk, result, 1200)) return true;
    const ia2 = sdk.findInventoryItem(a);
    const ib2 = sdk.findInventoryItem(b);
    if (ia2 && ib2) await sdk.sendUseItemOnItem(ib2.slot, ia2.slot);
    if (await waitInv(sdk, result, waitMs)) return true;
  }
  return has(sdk, result);
}

// Enter (down=true) or exit (down=false) the Draynor Manor vampire crypt (z > 9700) via the east warehouse doors.
export async function draynorManorCrypt(c: Ctx, down: boolean): Promise<boolean> {
  const { bot, sdk } = c;
  const inCrypt = () => (sdk.getState()?.player?.worldZ ?? 0) > 9700;
  if (down === inCrypt()) return true;
  if (!down && inCrypt()) {
    for (let i = 0; i < 4 && inCrypt(); i++) {
      await bot.walkTo(3077, 9769, 2);
      await bot.interactLoc(/stairs/i, /walk-?up|climb-?up/i);
      await waitCond(() => !inCrypt(), 6000, 400);
    }
    // Exit SE room -> warehouse -> courtyard via (3119,3356) and (3123,3360)
    for (let i = 0; i < 3; i++) {
      const p = sdk.getState()?.player;
      if (!p || p.worldZ > 3360) break;
      await sdk.sendWalk(3119, 3356, true);
      await sleep(1200);
      const d1 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3119, l.z - 3356) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
      if (d1) { await bot.interactLoc(d1, /^open$/i); await sleep(900); }
      await sdk.sendWalk(3123, 3359, true);
      await sleep(1400);
      const d2 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3123, l.z - 3360) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
      if (d2) { await bot.interactLoc(d2, /^open$/i); await sleep(900); }
      await sdk.sendWalk(3123, 3362, true);
      await sleep(1400);
    }
    return !inCrypt();
  }
  await bot.walkTo(3123, 3361, 1);
  for (let i = 0; i < 4 && !inCrypt(); i++) {
    const d2 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3123, l.z - 3360) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d2) { await bot.interactLoc(d2, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3120, 3356, true);
    await sleep(1400);
    const d1 = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /door/i.test(l.name) && Math.hypot(l.x - 3119, l.z - 3356) <= 2 && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
    if (d1) { await bot.interactLoc(d1, /^open$/i); await sleep(900); }
    await sdk.sendWalk(3116, 3356, true);
    await sleep(1400);
    await bot.interactLoc(/stairs/i, /walk-?down|climb-?down/i);
    await waitCond(() => inCrypt(), 6000, 400);
  }
  return inCrypt();
}
