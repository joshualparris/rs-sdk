import { runScript } from '../../sdk/runner';
import { appendFileSync } from 'fs';

const LOG = new URL('./lab_log.md', import.meta.url).pathname;
const log = (m: string) => { console.log(m); appendFileSync(LOG, `- ${new Date().toISOString()} ${m}\n`); };
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

type Ctx = { bot: any; sdk: any };
type Quest = { name: string; run: (c: Ctx) => Promise<boolean> };
const has = (sdk: any, re: RegExp) => !!sdk.findInventoryItem(re);

async function chat({ sdk }: Ctx, want: RegExp[] = [], max = 25) {
  for (let i = 0; i < max; i++) {
    const d = sdk.getState()?.dialog;
    if (!d?.isOpen) { if (i > 3) return; await sleep(250); continue; }
    const opt = d.options.find((o: any) => want.some(w => w.test(o.text)));
    await sdk.sendClickDialog(opt ? opt.index : 0);
    await sleep(300);
  }
}
async function talk(c: Ctx, npc: RegExp, want: RegExp[] = []) {
  const r = await c.bot.talkTo(npc);
  if (!r.success) { log(`talkTo ${npc} failed: ${r.message ?? r.reason}`); return false; }
  await chat(c, want);
  return true;
}
async function waitInv(sdk: any, re: RegExp, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (has(sdk, re)) return true; await sleep(300); }
  return false;
}

async function getEgg({ bot, sdk }: Ctx) {
  if (has(sdk, /^egg$/i)) return true;
  await bot.walkTo(3231, 3295);
  const egg = sdk.getState()?.groundItems?.find((g: any) => /^egg$/i.test(g.name));
  if (!egg) { log('no egg visible'); return false; }
  await bot.pickupItem(egg);
  return waitInv(sdk, /^egg$/i, 5000);
}

async function getMilk({ bot, sdk }: Ctx) {
  if (has(sdk, /bucket of milk/i)) return true;
  if (!has(sdk, /^bucket$/i)) { log('no bucket'); return false; }
  await bot.walkTo(3253, 3270);
  await sleep(1500);
  const cow = sdk.getState()?.nearbyNpcs?.find((n: any) => /^cow$/i.test(n.name));
  if (!cow) { log('no cow nearby'); return false; }
  const m = await bot.useItemOnNpc(/^bucket$/i, cow);
  log(`milk attempt: ${m.success} ${m.message ?? m.reason ?? ''}`);
  return waitInv(sdk, /bucket of milk/i, 6000);
}

async function getFlour({ bot, sdk }: Ctx) {
  if (has(sdk, /pot of flour/i)) return true;
  if (!has(sdk, /^pot$/i)) { log('no empty pot'); return false; }

  // 1. grain
  if (!has(sdk, /^grain$/i)) {
    await bot.walkTo(3165, 3298, 1);
    await sleep(1000);
    const field = (sdk.getState()?.nearbyLocs ?? []).filter((l: any) => /^wheat$/i.test(l.name));
    field.sort((x: any, y: any) => Math.hypot(x.x - 3162, x.z - 3299) - Math.hypot(y.x - 3162, y.z - 3299));
    for (const w of field.slice(0, 10)) {
      const r = await bot.interactLoc(w, 'Pick');
      log(`pick wheat ${w.x},${w.z}: ${r.success} ${r.message ?? r.reason ?? ''}`);
      if (await waitInv(sdk, /^grain$/i, 4000)) break;
    }
    if (!has(sdk, /^grain$/i)) { log('no grain obtained'); return false; }
  }

  // 2. upstairs: ladder at (3164,3307), then hopper + controls
  await bot.walkTo(3165, 3306, 1);
  log(`ladder up: ${JSON.stringify(await bot.interactLoc(/^ladder$/i, 'Climb-up'))}`);
  await sleep(2500);
  log(`ladder up 2: ${JSON.stringify(await bot.interactLoc(/^ladder$/i, 'Climb-up'))}`);
  await sleep(2500);
  const h = await bot.useItemOnLoc(/^grain$/i, /^hopper$/i);
  log(`hopper: ${h.success} ${h.message ?? h.reason ?? ''}`);
  await sleep(2500);
  const c = await bot.interactLoc(/hopper controls/i, 'Operate');
  log(`controls: ${c.success} ${c.message ?? c.reason ?? ''}`);
  await sleep(3500);

  // 3. downstairs: collect flour from the bin
  const d2 = await bot.interactLoc(/^ladder$/i, /climb-?down/i);
  log(`ladder down 2: ${d2.success} ${d2.message ?? d2.reason ?? ''}`);
  await sleep(2500);
  const d = await bot.interactLoc(/^ladder$/i, /climb-?down/i);
  log(`ladder down: ${d.success} ${d.message ?? d.reason ?? ''}`);
  await sleep(2500);
  const b = await bot.interactLoc(/flour bin/i, 'Empty');
  log(`bin: ${b.success} ${b.message ?? b.reason ?? ''}`);
  return waitInv(sdk, /pot of flour/i, 5000);
}

const cooksAssistant: Quest = {
  name: "Cook's Assistant",
  async run(c) {
    const { bot, sdk } = c;
    if (!has(sdk, /^pot$/i) || !(has(sdk, /^bucket$/i) || has(sdk, /bucket of milk/i))) { log('missing pot/bucket'); return false; }

    // 1. start the quest
    await bot.walkTo(3209, 3214);
    if (!(await talk(c, /^cook$/i, [/what's wrong/i, /i'll help|yes/i]))) return false;

    // 2. ingredients
    if (!(await getEgg(c))) return false;
    if (!(await getMilk(c))) return false;
    if (!(await getFlour(c))) return false;

    // 3. hand in
    await bot.walkTo(3209, 3214);
    if (!(await talk(c, /^cook$/i))) return false;
    await sleep(1000);
    return !has(sdk, /pot of flour/i) && !has(sdk, /bucket of milk/i);
  },
};

const QUESTS: Quest[] = [cooksAssistant];

await runScript(async (ctx) => {
  await ctx.bot.skipTutorial();
  for (const q of QUESTS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      log(`START ${q.name} (attempt ${attempt})`);
      try {
        if (await q.run(ctx as Ctx)) { log(`DONE ${q.name}`); break; }
        log(`FAILED ${q.name}`);
      } catch (e: any) { log(`ERROR ${q.name}: ${e?.message ?? e}`); }
      await ctx.bot.dismissBlockingUI();
    }
  }
}, { timeout: 15 * 60_000 });
