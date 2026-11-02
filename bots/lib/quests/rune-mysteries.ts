import { Ctx, Quest, has, log, sleep, talk, waitInv, waitCond, step, lumbridgeStairs, wizardsTowerBasement, walkToVarrock, walkFromVarrockToLumbridge, openNearbyDoors } from '../quest-kit';
const N = 'Rune Mysteries';

export const runemysteries: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let alreadyComplete = false;

    const start = () => step(c, N, 'start', async () => {
      if (has(sdk, /^air talisman$/i) || has(sdk, /^research package$/i) || has(sdk, /^notes$/i)) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 9000 && !(await wizardsTowerBasement(c, false))) return false;
      if (!(await lumbridgeStairs(c, 1))) return false;
      const w = await bot.walkTo(3210, 3220, 2);
      if (!w?.success) { await openNearbyDoors(c, 3210, 3220, 2); await bot.walkTo(3210, 3220, 2); }
      if (!(await talk(c, /^duke horacio$/i, [/have you any quests for me/i, /sure, no problem/i]))) return false;
      const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/all is well for me/i.test(recent)) { alreadyComplete = true; return true; }
      return waitInv(sdk, /^air talisman$/i, 4000);
    });

    const enterSedridorRoom = async () => {
      if (!(await wizardsTowerBasement(c, true))) return false;
      const p = sdk.getState()?.player;
      if (!p || p.worldZ > 9575 || p.worldX > 3107) {
        let w = await bot.walkTo(3104, 9571, 2);
        if (!w?.success) {
          await bot.walkTo(3109, 9571, 2);
          await openNearbyDoors(c, 3108, 9570, 2);
          w = await bot.walkTo(3104, 9571, 2);
        }
      }
      return true;
    };

    const pkg = () => step(c, N, 'package', async () => {
      if (alreadyComplete || has(sdk, /^research package$/i) || has(sdk, /^notes$/i)) return true;
      if (!(await enterSedridorRoom())) return false;
      for (let round = 0; round < 3 && !has(sdk, /^research package$/i); round++) {
        await talk(c, /^sedridor$/i, [/looking for the head wizard/i, /ok, here you are/i, /yes, certainly/i, /nothing thanks/i]);
        const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
        if (/teleport me to the rune essence/i.test(recent)) { alreadyComplete = true; return true; }
        if (await waitInv(sdk, /^research package$/i, 3000)) return true;
      }
      return has(sdk, /^research package$/i);
    });

    const notes = () => step(c, N, 'notes', async () => {
      if (alreadyComplete || has(sdk, /^notes$/i)) return true;
      if (!(await walkToVarrock(c, 3253, 3398))) return false;
      for (let round = 0; round < 3 && !has(sdk, /^notes$/i); round++) {
        const w = await bot.walkTo(3253, 3401, 2);
        if (!w?.success) { await openNearbyDoors(c, 3253, 3401, 2); await bot.walkTo(3253, 3401, 2); }
        await talk(c, /^aubury$/i, [/package for you/i, /no thank you/i]);
        await sleep(800);
      }
      return waitInv(sdk, /^notes$/i, 4000);
    });

    const finish = () => step(c, N, 'finish', async () => {
      if (alreadyComplete) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 3300 && (sdk.getState()?.player?.worldZ ?? 0) < 9000) {
        if (!(await walkFromVarrockToLumbridge(c, 3109, 3167))) return false;
      }
      if (!(await enterSedridorRoom())) return false;
      if (!(await talk(c, /^sedridor$/i))) return false;
      const done = await waitCond(() => !has(sdk, /^notes$/i) && has(sdk, /^air talisman$/i), 6000);
      await bot.closeInterface();
      await wizardsTowerBasement(c, false);
      return done;
    });

    return (await start()) && (await pkg()) && (await notes()) && (await finish());
  },
};
