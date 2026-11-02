import { Ctx, Quest, has, count, lvl, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, pickupWithWait, bankJunk, withdrawFromDraynorBank, walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround } from '../quest-kit';
import { cooks } from './cooks-assistant';
import { doric } from './dorics-quest';
import { hetty } from './witchs-potion';
import { romeojuliet } from './romeo-and-juliet';
import { haunted } from './ernest-the-chicken';

const N = "Black Knights' Fortress";

const KEEP_RE = /^(coins|bronze sword|wooden shield|bronze med helm|iron chainbody|cabbage)$/i;

export const blackknight: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let started = false;
    let listened = false;
    let sabotaged = false;
    let questComplete = false;

    const walkInRoom = async (x: number, z: number, tol = 1, timeout = 5000) => {
      const p0 = sdk.getState()?.player;
      if (p0 && Math.hypot(p0.worldX - x, p0.worldZ - z) <= tol) return true;
      await sdk.sendWalk(x, z, true);
      return await waitCond(() => {
        const p = sdk.getState()?.player;
        return !!p && Math.hypot(p.worldX - x, p.worldZ - z) <= tol;
      }, timeout, 250);
    };

    const climbSirAmikTo = async (targetLvl: 0 | 2): Promise<boolean> => {
      for (let round = 0; round < 6 && lvl(sdk) !== targetLvl; round++) {
        const cur = lvl(sdk);
        if (cur === 0 && targetLvl === 2) {
          const w = await bot.walkTo(2955, 3338, 2);
          if (!w?.success) {
            await openNearbyDoors(c, 2965, 3338, 2);
            await openNearbyDoors(c, 2965, 3339, 2);
            await bot.walkTo(2955, 3338, 2);
          }
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1738 && Math.hypot(l.x - 2954, l.z - 3338) <= 2);
          if (st) await bot.interactLoc(st, /(walk|climb)-?up/i);
          else await bot.interactLoc(/^staircase$/i, /(walk|climb)-?up/i);
          await waitCond(() => lvl(sdk) === 1, 5000, 300);
        } else if (cur === 1 && targetLvl === 2) {
          await walkInRoom(2960, 3339, 1, 4000);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1738 && Math.hypot(l.x - 2960, l.z - 3338) <= 2);
          if (st) await bot.interactLoc(st, /(walk|climb)-?up/i);
          else await bot.interactLoc(/^staircase$/i, /(walk|climb)-?up/i);
          await waitCond(() => lvl(sdk) === 2, 5000, 300);
        } else if (cur === 2 && targetLvl === 0) {
          await walkInRoom(2960, 3338, 1, 4000);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1740 && Math.hypot(l.x - 2960, l.z - 3339) <= 2);
          if (st) await bot.interactLoc(st, /(walk|climb)-?down/i);
          else await bot.interactLoc(/^staircase$/i, /(walk|climb)-?down/i);
          await waitCond(() => lvl(sdk) === 1, 5000, 300);
        } else if (cur === 1 && targetLvl === 0) {
          await walkInRoom(2956, 3338, 1, 4000);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1740 && Math.hypot(l.x - 2955, l.z - 3338) <= 2);
          if (st) await bot.interactLoc(st, /(walk|climb)-?down/i);
          else await bot.interactLoc(/^staircase$/i, /(walk|climb)-?down/i);
          await waitCond(() => lvl(sdk) === 0, 5000, 300);
        }
      }
      return lvl(sdk) === targetLvl;
    };

    const prepAndStart = () => step(c, N, 'prep-and-start', async () => {
      if (started || questComplete) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0 && (sdk.getState()?.player?.worldX ?? 0) > 3000) await lumbridgeStairs(c, 0);

      // Ensure 12 Quest Points if running standalone on a fresh bot
      if ((sdk.getSkill('Cooking')?.experience ?? 0) < 100 && (sdk.getSkill('Mining')?.experience ?? 0) < 100 && (sdk.getSkill('Magic')?.experience ?? 0) < 100) {
        if (!(await cooks.run(c))) return false;
        if (!(await doric.run(c))) return false;
        if (!(await hetty.run(c))) return false;
        if (!(await romeojuliet.run(c))) return false;
        if (!(await haunted.run(c))) return false;
      }

      if (lvl(sdk) === 0) {
        await bankJunk(c, KEEP_RE);
        await withdrawFromDraynorBank(c, [/^coins$/i, /^bronze sword$/i, /^wooden shield$/i, /^bronze med helm$/i, /^iron chainbody$/i]);
        if (has(sdk, /^bronze sword$/i)) await bot.equipItem(/^bronze sword$/i);
        if (has(sdk, /^wooden shield$/i)) await bot.equipItem(/^wooden shield$/i);

        const wearingHelm = () => (sdk.getState()?.equipment ?? []).some((e: any) => /^bronze med helm$/i.test(e.name));
        const wearingChain = () => (sdk.getState()?.equipment ?? []).some((e: any) => /^iron chainbody$/i.test(e.name));

        // 1. Get Bronze med helm from Draynor Manor east room (3122, 3360)
        if (!has(sdk, /^bronze med helm$/i) && !wearingHelm()) {
          await bot.walkTo(3108, 3352, 1);
          const front = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => (l.id === 134 || l.id === 135) && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
          if (front) {
            await bot.interactLoc(front, /^open$/i);
            await waitCond(() => (sdk.getState()?.player?.worldZ ?? 0) >= 3354, 5000, 300);
          }
          const wh = await bot.walkTo(3121, 3360, 2);
          if (!wh?.success) {
            await openNearbyDoors(c, 3119, 3356, 2);
            await bot.walkTo(3121, 3360, 2);
          }
          if (!(await pickupWithWait(c, 3122, 3360, /^bronze med helm$/i, 20))) return false;
          const we = await bot.walkTo(3124, 3360, 2);
          if (!we?.success) {
            await openNearbyDoors(c, 3123, 3360, 2);
            await openNearbyDoors(c, 3101, 3371, 2);
          }
        }

        // 2. Get Iron chainbody from Horvik in Varrock (3229, 3437) for 210gp
        if (!has(sdk, /^iron chainbody$/i) && !wearingChain()) {
          if (count(sdk, /^coins$/i) < 220) {
            if ((sdk.getState()?.player?.worldX ?? 3100) < 3180) await bot.walkTo(3185, 3245, 3);
            await bot.walkTo(3248, 3240, 3);
            await sdk.sendSetCombatStyle(1);
            const deadline = Date.now() + 210_000;
            while (Date.now() < deadline && count(sdk, /^coins$/i) < 225) {
              await bot.dismissBlockingUI();
              const gc = sdk.findGroundItem(/^coins$/i);
              if (gc) { await bot.pickupItem(gc); await sleep(600); }
              const px = sdk.getState()?.player?.worldX ?? 3248;
              const pz = sdk.getState()?.player?.worldZ ?? 3240;
              if (Math.hypot(px - 3248, pz - 3240) > 18) await bot.walkTo(3248, 3240, 3);
              const gob = (sdk.getState()?.nearbyNpcs ?? [])
                .filter((n: any) => /^goblin$/i.test(n.name) && n.combatLevel <= 5 && n.x >= 3242 && n.x <= 3260 && n.z >= 3225 && n.z <= 3252)
                .sort((a: any, b: any) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
              if (gob && !sdk.getState()?.player?.combat?.inCombat) await bot.attack(gob);
              await sleep(700);
            }
          }
          if (!(await walkToVarrock(c, 3229, 3437))) return false;
          const who = await bot.walkTo(3229, 3437, 2);
          if (!who?.success) { await openNearbyDoors(c, 3229, 3437, 3); await bot.walkTo(3229, 3437, 2); }
          for (let i = 0; i < 3 && !has(sdk, /^iron chainbody$/i); i++) {
            const o = await bot.openShop(/^horvik$/i);
            if (o?.success) {
              await bot.buyFromShop(/^iron chainbody$/i, 1);
              await bot.closeShop();
            }
            await sleep(500);
          }
          if (!has(sdk, /^iron chainbody$/i)) return false;
          await walkFromVarrockToLumbridge(c, 3110, 3260);
        }

        // 3. Pick normal Cabbage (id 1965) at (3054, 3285)
        const hasNormalCabbage = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 1965);
        if (!hasNormalCabbage()) {
          await bot.walkTo(3054, 3285, 3);
          for (let i = 0; i < 6 && !hasNormalCabbage(); i++) {
            await bot.interactLoc(/^cabbage$/i, /^pick$/i);
            await waitCond(() => hasNormalCabbage(), 3500, 300);
          }
          if (!hasNormalCabbage()) return false;
        }

        // 4. Walk to Falador Castle West Tower
        await bot.walkTo(3007, 3330, 3);
        await bot.walkTo(2966, 3338, 2);
      }

      if (!(await climbSirAmikTo(2))) return false;
      await walkInRoom(2961, 3337, 2, 4000);
      if (!(await talk(c, /^sir amik varze$/i, [/seek a quest/i, /laugh in the face of danger/i, /ok, i'll do my best/i]))) return false;
      const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/at least 12 quest points/i.test(recent)) return false;
      await climbSirAmikTo(0);
      started = true;
      return true;
    });

    const spyAndSabotage = () => step(c, N, 'spy-and-sabotage', async () => {
      if (questComplete || sabotaged) return true;
      if (lvl(sdk) > 0 && (sdk.getState()?.player?.worldZ ?? 0) < 3400) {
        await climbSirAmikTo(0);
      }
      if (has(sdk, /^bronze med helm$/i)) await bot.equipItem(/^bronze med helm$/i);
      if (has(sdk, /^iron chainbody$/i)) await bot.equipItem(/^iron chainbody$/i);

      // Walk to Black Knights' Fortress entrance at (3016, 3513)
      if ((sdk.getState()?.player?.worldZ ?? 0) < 3505) {
        await bot.walkTo(2965, 3385, 3);
        await bot.walkTo(2995, 3440, 3);
        await bot.walkTo(3016, 3513, 1);
      }

      const passFortressDoor = async (doorId: number, sx: number, sz: number, pred: () => boolean, choices?: RegExp[]) => {
        for (let i = 0; i < 4 && !pred(); i++) {
          await walkInRoom(sx, sz, 0, 5000);
          const d = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === doorId);
          if (d) await bot.interactLoc(d, /^(open|push)$/i);
          if (choices && (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 3000, 250))) {
            await chat(c, choices);
          }
          if (await waitCond(pred, 4000, 250)) { await sleep(300); return true; }
        }
        return pred();
      };

      const climbFortressLadder = async (ladId: number, sx: number, sz: number, dir: 'up' | 'down', targetL: number) => {
        for (let i = 0; i < 4 && lvl(sdk) !== targetL; i++) {
          await walkInRoom(sx, sz, 1, 5000);
          const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === ladId && Math.hypot(l.x - sx, l.z - sz) <= 2);
          if (lad) await bot.interactLoc(lad, dir === 'up' ? /climb-?up/i : /climb-?down/i);
          else await bot.interactLoc(/^ladder$/i, dir === 'up' ? /climb-?up/i : /climb-?down/i);
          if (await waitCond(() => lvl(sdk) === targetL, 5000, 250)) { await sleep(300); return true; }
        }
        return lvl(sdk) === targetL;
      };

      // Enter front door (2337 at 3016,3514) -> z >= 3515
      if (lvl(sdk) === 0 && (sdk.getState()?.player?.worldZ ?? 0) <= 3514) {
        if (!(await passFortressDoor(2337, 3016, 3513, () => (sdk.getState()?.player?.worldZ ?? 0) >= 3515))) return false;
      }

      if (!listened) {
        // Push secret wall (2341 at 3016,3517) -> z >= 3517
        if (!(await passFortressDoor(2341, 3016, 3516, () => (sdk.getState()?.player?.worldZ ?? 0) >= 3517))) return false;
        // Climb up 1750 at L0 (3015,3519) -> L1
        if (!(await climbFortressLadder(1750, 3015, 3518, 'up', 1))) return false;
        // Climb up 1750 at L1 (3016,3519) -> L2
        if (!(await climbFortressLadder(1750, 3016, 3518, 'up', 2))) return false;
        // Climb down 1746 at L2 (3017,3516) -> L1
        if (!(await climbFortressLadder(1746, 3017, 3515, 'down', 1))) return false;
        // Open doors at L1 (3019,3515) and L1 (3021,3515) and climb up 1750 at L1 (3023,3513) -> L2
        const w1 = await bot.walkTo(3023, 3514, 1);
        if (!w1?.success) {
          await openNearbyDoors(c, 3019, 3515, 2);
          await openNearbyDoors(c, 3021, 3515, 2);
          await bot.walkTo(3023, 3514, 1);
        }
        if (!(await climbFortressLadder(1750, 3023, 3514, 'up', 2))) return false;
        // Climb down 1749 at L2 (3025,3513) -> L1
        if (!(await climbFortressLadder(1749, 3025, 3514, 'down', 1))) return false;
        // Open sturdy door 2339 at L1 (3025,3511) -> z <= 3511
        if (!(await passFortressDoor(2339, 3025, 3512, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 3511))) return false;
        // Climb down 1746 at L1 (3021,3510) -> L0
        if (!(await climbFortressLadder(1746, 3022, 3510, 'down', 0))) return false;
        // Listen at Grill (2342 at L0 3025,3507)
        await walkInRoom(3025, 3507, 0, 5000);
        const grill = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2342);
        if (grill) await bot.interactLoc(grill, /listen/i);
        else await bot.interactLoc(/^grill$/i, /listen/i);
        if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 4000, 250)) {
          await chat(c);
        }
        listened = true;

        // Return to entrance hall L0 (3016, 3515)
        if (!(await climbFortressLadder(1747, 3022, 3510, 'up', 1))) return false;
        if (!(await passFortressDoor(2339, 3025, 3511, () => (sdk.getState()?.player?.worldZ ?? 0) >= 3512))) return false;
        if (!(await climbFortressLadder(1750, 3025, 3514, 'up', 2))) return false;
        if (!(await climbFortressLadder(1749, 3023, 3514, 'down', 1))) return false;
        const w2 = await bot.walkTo(3017, 3515, 1);
        if (!w2?.success) {
          await openNearbyDoors(c, 3021, 3515, 2);
          await openNearbyDoors(c, 3019, 3515, 2);
          await bot.walkTo(3017, 3515, 1);
        }
        if (!(await climbFortressLadder(1747, 3017, 3515, 'up', 2))) return false;
        if (!(await climbFortressLadder(1749, 3016, 3518, 'down', 1))) return false;
        if (!(await climbFortressLadder(1749, 3015, 3518, 'down', 0))) return false;
        if (!(await passFortressDoor(2341, 3016, 3517, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 3516))) return false;
      }

      // Enter east banquet hall via 2338 at L0 (3020, 3515) -> x >= 3020
      if (lvl(sdk) === 0 && (sdk.getState()?.player?.worldX ?? 0) < 3020) {
        if (!(await passFortressDoor(2338, 3019, 3515, () => (sdk.getState()?.player?.worldX ?? 0) >= 3020, [/going in anyway/i]))) return false;
      }
      // Climb up 1750 at L0 (3022, 3518) -> L1
      if (lvl(sdk) === 0) {
        if (!(await climbFortressLadder(1750, 3022, 3517, 'up', 1))) return false;
      }
      // Walk along L1 gallery to (3030, 3511) and push secret wall 2341 at L1 (3030, 3510) -> z <= 3509
      await walkInRoom(3028, 3516, 1, 5000);
      await walkInRoom(3030, 3511, 1, 5000);
      if (!(await passFortressDoor(2341, 3030, 3510, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 3509))) return false;

      // Use normal Cabbage (id 1965) on Hole (2336 at L1 3031, 3507)
      await walkInRoom(3031, 3508, 0, 5000);
      const hole = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2336);
      const cab = (sdk.getInventory() ?? []).find((i: any) => i.id === 1965);
      if (hole && cab) {
        await sdk.sendUseItemOnLoc(cab.slot, hole.x, hole.z, hole.id);
      } else {
        await bot.useItemOnLoc(/^cabbage$/i, /^hole$/i);
      }
      if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 5000, 250)) {
        await chat(c);
      }
      if (!(await waitCond(() => !(sdk.getInventory() ?? []).some((i: any) => i.id === 1965), 5000, 300))) return false;
      sabotaged = true;

      // Exit fortress
      await passFortressDoor(2341, 3030, 3509, () => (sdk.getState()?.player?.worldZ ?? 0) >= 3510);
      await walkInRoom(3028, 3516, 1, 5000);
      await climbFortressLadder(1749, 3022, 3517, 'down', 0);
      await passFortressDoor(2338, 3020, 3515, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3019);
      await passFortressDoor(2337, 3016, 3514, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 3513);
      return true;
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (questComplete) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 3400) {
        await bot.walkTo(2995, 3440, 3);
        await bot.walkTo(2965, 3385, 3);
        await bot.walkTo(2966, 3338, 2);
      }
      if (!(await climbSirAmikTo(2))) return false;
      await walkInRoom(2961, 3337, 2, 4000);
      const coinsBefore = count(sdk, /^coins$/i);
      await talk(c, /^sir amik varze$/i);
      const done = await waitCond(() => count(sdk, /^coins$/i) >= coinsBefore + 2500 || !!sdk.getState()?.interface?.isOpen, 6000, 300);
      await bot.closeInterface();
      await climbSirAmikTo(0);
      questComplete = done;
      return done;
    });

    return (await prepAndStart()) && (await spyAndSabotage()) && (await handIn());
  },
};
