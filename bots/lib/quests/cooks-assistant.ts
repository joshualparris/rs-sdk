import { Ctx, Quest, has, log, sleep, talk, waitInv, waitCond, step, xp, lvl, lumbridgeStairs } from '../quest-kit';
const N = "Cook's Assistant";
const COOK = [3209, 3214] as const;

export const cooks: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (xp(sdk, 'Cooking') >= 300) { log(c, 'already completed'); return true; }
    if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
    if (!has(sdk, /^pot$/i) && !has(sdk, /pot of flour/i)) { log(c, 'missing pot'); return false; }
    if (!has(sdk, /^bucket$/i) && !has(sdk, /bucket of milk/i)) { log(c, 'missing bucket'); return false; }

    const start = () => step(c, N, 'start', async () => {
      if (has(sdk, /pot of flour/i) || has(sdk, /bucket of milk/i) || has(sdk, /^egg$/i)) return true;
      await bot.walkTo(...COOK);
      return talk(c, /^cook$/i, [/what's wrong/i, /i'll help|yes/i]);
    });

    const egg = () => step(c, N, 'egg', async () => {
      if (has(sdk, /^egg$/i)) return true;
      await bot.walkTo(3231, 3295);
      for (let i = 0; i < 15; i++) {
        const e = sdk.getState()?.groundItems?.find((g: any) => /^egg$/i.test(g.name));
        if (e) { await bot.pickupItem(e); if (await waitInv(sdk, /^egg$/i, 5000)) return true; }
        await sleep(1000);
      }
      return false;
    });

    const milk = () => step(c, N, 'milk', async () => {
      if (has(sdk, /bucket of milk/i)) return true;
      await bot.walkTo(3253, 3270); await sleep(1500);
      const cow = sdk.getState()?.nearbyNpcs?.find((n: any) => /^cow$/i.test(n.name));
      if (!cow) return false;
      await bot.useItemOnNpc(/^bucket$/i, cow);
      return waitInv(sdk, /bucket of milk/i, 6000);
    });

    const grain = () => step(c, N, 'grain', async () => {
      if (has(sdk, /^grain$/i) || has(sdk, /pot of flour/i)) return true;
      await bot.walkTo(3165, 3298, 1); await sleep(1000);
      const field = (sdk.getState()?.nearbyLocs ?? []).filter((l: any) => /^wheat$/i.test(l.name));
      field.sort((a: any, b: any) => Math.hypot(a.x - 3162, a.z - 3299) - Math.hypot(b.x - 3162, b.z - 3299));
      for (const w of field.slice(0, 10)) {
        await bot.interactLoc(w, 'Pick');
        if (await waitInv(sdk, /^grain$/i, 4000)) return true;
      }
      return false;
    });

    const mill = () => step(c, N, 'mill', async () => {
      if (has(sdk, /pot of flour/i)) return true;
      await bot.walkTo(3165, 3306, 1);
      await bot.interactLoc(/^ladder$/i, 'Climb-up'); await sleep(2500);
      await bot.interactLoc(/^ladder$/i, 'Climb-up'); await sleep(2500);
      await bot.useItemOnLoc(/^grain$/i, /^hopper$/i); await sleep(2500);
      await bot.interactLoc(/hopper controls/i, 'Operate'); await sleep(3500);
      await bot.interactLoc(/^ladder$/i, /climb-?down/i); await sleep(2500);
      await bot.interactLoc(/^ladder$/i, /climb-?down/i); await sleep(2500);
      await bot.interactLoc(/flour bin/i, 'Empty');
      return waitInv(sdk, /pot of flour/i, 5000);
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      await bot.walkTo(...COOK);
      if (!(await talk(c, /^cook$/i))) return false;
      const done = await waitCond(() => xp(sdk, 'Cooking') >= 300, 6000);
      await bot.closeInterface();
      return done;
    });

    return (await start()) && (await egg()) && (await milk()) && (await grain()) && (await mill()) && (await handIn());
  },
};
