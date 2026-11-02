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

// Click through a dialog, choosing the first option matching `want`, else "continue".
export async function chat({ sdk }: Ctx, want: RegExp[] = [], max = 40) {
  let closed = 0;
  for (let i = 0; i < max; i++) {
    const d = sdk.getState()?.dialog;
    if (!d?.isOpen) {
      if (++closed >= 5) return;
      await sleep(250);
      continue;
    }
    closed = 0;
    const opt = d.options.find((o: any) => want.some(w => w.test(o.text)));
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
  }, { timeout: 20 * 60_000 });
}

// Empty the inventory into the Draynor bank, keeping only items matching `keep`. Equipment stays on.
export async function bankJunk(c: Ctx, keep: RegExp = /^(coins|shears|wool|ball of wool)$/i) {
  const { bot, sdk } = c;
  const junk = () => (sdk.getState()?.inventory ?? []).filter((i: any) => !keep.test(i.name));
  if (junk().length === 0) return true;
  if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
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
