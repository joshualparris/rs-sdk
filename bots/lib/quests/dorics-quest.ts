import { Ctx, Quest, has, count, xp, lvl, sleep, talk, waitCond, step, lumbridgeStairs, openNearbyDoors, bankJunk, withdrawFromDraynorBank, exitWizardsTowerGround } from '../quest-kit';
const N = "Doric's Quest";

export const doric: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (xp(sdk, 'Mining') >= 13000) return true;

    const mineCount = async (x: number, z: number, rockIds: number[], itemRe: RegExp, target: number) => {
      if (count(sdk, itemRe) >= target) return true;
      await bot.walkTo(x, z, 2);
      for (let tries = 0; tries < target * 6 && count(sdk, itemRe) < target; tries++) {
        const rock = (sdk.getState()?.nearbyLocs ?? []).find(
          (l: any) => rockIds.includes(l.id) && (l.options ?? []).some((o: string) => /^mine$/i.test(o))
        );
        if (!rock) { await sleep(1200); continue; }
        const before = count(sdk, itemRe);
        await bot.interactLoc(rock, 'Mine');
        await waitCond(() => count(sdk, itemRe) > before, 8000, 300);
      }
      return count(sdk, itemRe) >= target;
    };

    const prep = () => step(c, N, 'prep', async () => {
      if (xp(sdk, 'Mining') >= 13000) return true;
      if (count(sdk, /^clay$/i) >= 6 && count(sdk, /^copper ore$/i) >= 4 && count(sdk, /^iron ore$/i) >= 2) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
      await bankJunk(c, /^(coins|bronze pickaxe|clay|copper ore|iron ore)$/i);
      if (!has(sdk, /^bronze pickaxe$/i)) {
        await withdrawFromDraynorBank(c, [/^bronze pickaxe$/i]);
      }
      return has(sdk, /^bronze pickaxe$/i);
    });

    const mineOres = () => step(c, N, 'mine-ores', async () => {
      if (xp(sdk, 'Mining') >= 13000) return true;
      if ((sdk.getState()?.player?.worldX ?? 0) > 3040) {
        await bot.walkTo(3035, 3236, 3);
      }
      if (count(sdk, /^clay$/i) < 6) {
        if (!(await mineCount(2986, 3239, [2108, 2109], /^clay$/i, 6))) return false;
      }
      if (count(sdk, /^copper ore$/i) < 4) {
        if (!(await mineCount(2977, 3247, [2090, 2091], /^copper ore$/i, 4))) return false;
      }
      if (count(sdk, /^iron ore$/i) < 2) {
        if (!(await mineCount(2969, 3240, [2092, 2093], /^iron ore$/i, 2))) return false;
      }
      return true;
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (xp(sdk, 'Mining') >= 13000) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) < 3320) {
        await bot.walkTo(3007, 3280, 3);
        await bot.walkTo(3007, 3330, 3);
      }
      await bot.walkTo(2965, 3385, 3);
      await bot.walkTo(2946, 3415, 3);
      const w = await bot.walkTo(2951, 3451, 2);
      if (!w?.success) { await openNearbyDoors(c, 2950, 3450, 2); await bot.walkTo(2951, 3451, 2); }
      await talk(c, /^doric$/i, [/wanted to use your anvils/i, /will get you materials/i]);
      if (xp(sdk, 'Mining') < 13000 && count(sdk, /^clay$/i) >= 6) {
        await talk(c, /^doric$/i);
      }
      const done = await waitCond(() => xp(sdk, 'Mining') >= 13000, 6000);
      await bot.closeInterface();
      return done;
    });

    return (await prep()) && (await mineOres()) && (await handIn());
  },
};
