import { Ctx, Quest, has, xp, lvl, log, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, wizardsTowerBasement, openNearbyDoors, pickupWithWait } from '../quest-kit';
const N = 'The Restless Ghost';

export const priest: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (xp(sdk, 'Prayer') >= 1125) { log(c, 'already completed'); return true; }
    const hasAmulet = () => has(sdk, /^ghostspeak amulet$/i) || !!sdk.findEquipmentItem(/^ghostspeak amulet$/i);

    const start = () => step(c, N, 'start', async () => {
      if (hasAmulet() || has(sdk, /^skull$/i)) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 9000 && !(await wizardsTowerBasement(c, false))) return false;
      if (lvl(sdk) > 0 && !(await lumbridgeStairs(c, 0))) return false;
      const w = await bot.walkTo(3244, 3206, 2);
      if (!w?.success) { await openNearbyDoors(c, 3244, 3206, 2); await bot.walkTo(3244, 3206, 2); }
      return talk(c, /^father aereck$/i, [/looking for a quest/i]);
    });

    const urhney = () => step(c, N, 'urhney', async () => {
      if (hasAmulet() || has(sdk, /^skull$/i)) return true;
      await bot.walkTo(3200, 3195, 3);
      await bot.walkTo(3200, 3165, 3);
      const w = await bot.walkTo(3236, 3153, 2);
      if (!w?.success) { await openNearbyDoors(c, 3238, 3153, 2); await bot.walkTo(3236, 3153, 2); }
      if (!(await talk(c, /^father urhney$/i, [/father aereck sent me/i, /ghost haunting his graveyard/i, /lost the amulet/i]))) return false;
      return waitCond(() => hasAmulet(), 4000);
    });

    const ghost = () => step(c, N, 'ghost', async () => {
      if (has(sdk, /^skull$/i)) return true;
      if (has(sdk, /^ghostspeak amulet$/i)) {
        await bot.equipItem(/^ghostspeak amulet$/i);
        await sleep(600);
      }
      await bot.walkTo(3200, 3165, 3);
      await bot.walkTo(3200, 3195, 3);
      const w = await bot.walkTo(3249, 3194, 2);
      if (!w?.success) { await openNearbyDoors(c, 3248, 3194, 2); await bot.walkTo(3249, 3194, 2); }
      if (!sdk.findNearbyNpc(/^restless ghost$/i)) {
        const coffin = sdk.findNearbyLoc(/^coffin$/i);
        const opt = (coffin?.options ?? []).some((o: string) => /^open$/i.test(o)) ? 'Open' : 'Search';
        await bot.interactLoc(/^coffin$/i, opt);
        await waitCond(() => !!sdk.findNearbyNpc(/^restless ghost$/i), 5000);
        if (sdk.getState()?.dialog?.isOpen) await chat(c);
      }
      return talk(c, /^restless ghost$/i, [/tell me what the problem is/i]);
    });

    const skull = () => step(c, N, 'skull', async () => {
      if (has(sdk, /^skull$/i)) return true;
      if (!(await wizardsTowerBasement(c, true))) return false;
      const w = await bot.walkTo(3119, 9567, 2);
      if (!w?.success) { await openNearbyDoors(c, 3115, 9567, 2); await bot.walkTo(3119, 9567, 2); }
      const got = await pickupWithWait(c, 3120, 9567, /^skull$/i, 15);
      await wizardsTowerBasement(c, false);
      return got;
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (xp(sdk, 'Prayer') >= 1125) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 9000 && !(await wizardsTowerBasement(c, false))) return false;
      const w = await bot.walkTo(3249, 3194, 2);
      if (!w?.success) { await openNearbyDoors(c, 3248, 3194, 2); await bot.walkTo(3249, 3194, 2); }
      const coffin = sdk.findNearbyLoc(/^coffin$/i);
      if ((coffin?.options ?? []).some((o: string) => /^open$/i.test(o))) {
        await bot.interactLoc(/^coffin$/i, 'Open');
        await waitCond(() => (sdk.findNearbyLoc(/^coffin$/i)?.options ?? []).some((o: string) => /^close$/i.test(o)), 5000, 300);
        await sleep(600);
      }
      for (let i = 0; i < 3 && has(sdk, /^skull$/i); i++) {
        await bot.useItemOnLoc(/^skull$/i, /^coffin$/i);
        await sleep(900);
        if (sdk.getState()?.dialog?.isOpen) await chat(c);
      }
      const done = await waitCond(() => xp(sdk, 'Prayer') >= 1125, 6000);
      await bot.closeInterface();
      return done;
    });

    return (await start()) && (await urhney()) && (await ghost()) && (await skull()) && (await handIn());
  },
};
