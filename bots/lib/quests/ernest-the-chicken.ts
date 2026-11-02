import { Ctx, Quest, has, count, lvl, log, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, pickupWithWait, combineItems, bankJunk, exitWizardsTowerGround } from '../quest-kit';
const N = 'Ernest the Chicken';

const KEEP_RE = /^(coins|spade|fish food|poison|poisoned fish food|pressure gauge|key|rubber tube|oil can)$/i;

export const haunted: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let oddensteinSpoken = false;
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

    const enterManorL0 = async () => {
      const p = sdk.getState()?.player;
      if (!p) return false;
      if (p.worldZ > 9000) return false;
      // Already inside manor ground floor
      if (p.level === 0 && p.worldX >= 3097 && p.worldX <= 3122 && p.worldZ >= 3354 && p.worldZ <= 3370) {
        return true;
      }
      if (p.level === 0 && p.worldZ <= 3353) {
        await bot.walkTo(3108, 3352, 1);
        const front = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => (l.id === 134 || l.id === 135) && (l.options ?? []).some((o: string) => /^open$/i.test(o)));
        if (front) {
          await bot.interactLoc(front, /^open$/i);
          if (await waitCond(() => (sdk.getState()?.player?.worldZ ?? 0) >= 3354, 5000, 300)) return true;
        }
      }
      const w = await bot.walkTo(3108, 3361, 2);
      if (!w?.success) {
        await openNearbyDoors(c, 3101, 3371, 2);
        await bot.walkTo(3108, 3361, 2);
      }
      return true;
    };

    const interactLocDirect = async (loc: any, optRe: RegExp) => {
      if (!loc) return false;
      const idx = (loc.optionsWithIndex ?? []).find((o: any) => optRe.test(o.text))?.opIndex ?? 1;
      await sdk.sendInteractLoc(loc.x, loc.z, loc.id, idx);
      return true;
    };

    const openDoorOnFloor = async (dx: number, dz: number) => {
      const d = (sdk.getState()?.nearbyLocs ?? []).find(
        (l: any) => Math.hypot(l.x - dx, l.z - dz) <= 1 && (l.options ?? []).some((o: string) => /^open$/i.test(o))
      );
      if (d) {
        await interactLocDirect(d, /^open$/i);
        await sleep(900);
      }
    };

    const climbManorTo = async (targetLvl: 0 | 1 | 2): Promise<boolean> => {
      for (let round = 0; round < 6 && lvl(sdk) !== targetLvl; round++) {
        const cur = lvl(sdk);
        if (cur === 0 && targetLvl > 0) {
          await enterManorL0();
          const w = await bot.walkTo(3109, 3361, 2);
          if (!w?.success) { await openNearbyDoors(c, 3109, 3358, 2); await bot.walkTo(3109, 3361, 2); }
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1730);
          await interactLocDirect(st, /(walk|climb)-?up/i);
          await waitCond(() => lvl(sdk) === 1, 6000, 350);
        } else if (cur === 1 && targetLvl === 2) {
          const p = sdk.getState()?.player;
          if (p && p.worldZ <= 3364) {
            await bot.walkTo(3109, 3366, 2);
          }
          await walkInRoom(3105, 3367, 1, 4000);
          await walkInRoom(3105, 3363, 1, 4000);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1738);
          await interactLocDirect(st, /(walk|climb)-?up/i);
          await waitCond(() => lvl(sdk) === 2, 6000, 350);
        } else if (cur === 2 && targetLvl < 2) {
          const p = sdk.getState()?.player;
          if (p && p.worldX >= 3108) {
            await walkInRoom(3108, 3364, 1, 4000);
            await openDoorOnFloor(3108, 3364);
          }
          await walkInRoom(3105, 3364, 1, 4000);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1740);
          await interactLocDirect(st, /(walk|climb)-?down/i);
          await waitCond(() => lvl(sdk) === 1, 6000, 350);
        } else if (cur === 1 && targetLvl === 0) {
          const p = sdk.getState()?.player;
          if (p && p.worldZ <= 3364) {
            await bot.walkTo(3109, 3366, 2);
          } else {
            await walkInRoom(3105, 3367, 1, 4000);
            await walkInRoom(3109, 3366, 1, 4000);
          }
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1731);
          await interactLocDirect(st, /(walk|climb)-?down/i);
          await waitCond(() => lvl(sdk) === 0, 6000, 350);
        }
      }
      return lvl(sdk) === targetLvl;
    };

    const pickupFishFoodL1 = async (): Promise<boolean> => {
      if (has(sdk, /^fish food|poisoned fish food|pressure gauge$/i)) return true;
      if (!(await climbManorTo(1))) return false;
      const w = await bot.walkTo(3108, 3356, 2);
      if (!w?.success) {
        await openNearbyDoors(c, 3110, 3358, 2);
        await bot.walkTo(3108, 3356, 2);
      }
      return await pickupWithWait(c, 3108, 3356, /^fish food$/i, 15);
    };

    const walkToOddensteinL2 = async () => {
      if (!(await climbManorTo(2))) return false;
      if ((sdk.getState()?.player?.worldX ?? 0) < 3108) {
        await walkInRoom(3107, 3364, 0, 4000);
        await openDoorOnFloor(3108, 3364);
      }
      await walkInRoom(3110, 3366, 2, 4000);
      return true;
    };

    const start = () => step(c, N, 'start-veronica-and-oddenstein', async () => {
      if (questComplete || oddensteinSpoken || has(sdk, /^pressure gauge|rubber tube|oil can$/i)) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0 && (sdk.getState()?.player?.worldZ ?? 0) < 3350) await lumbridgeStairs(c, 0);
      if (lvl(sdk) === 0 && (sdk.getState()?.player?.worldZ ?? 0) < 9000) {
        await bankJunk(c, KEEP_RE);
        await bot.walkTo(3110, 3330, 2);
        if (!(await talk(c, /^veronica$/i, [/aha, sounds like a quest/i]))) return false;
        const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
        if (/thank you for rescuing ernest/i.test(recent)) {
          questComplete = true;
          return true;
        }
      }
      if (!has(sdk, /^fish food|poisoned fish food|pressure gauge$/i)) {
        await pickupFishFoodL1();
      }
      if (!(await walkToOddensteinL2())) return false;
      if (!(await talk(c, /^professor oddenstein$/i, [/looking for a guy called ernest/i, /change him back this instant/i]))) return false;
      oddensteinSpoken = true;
      return true;
    });

    const gauge = () => step(c, N, 'pressure-gauge', async () => {
      if (questComplete || has(sdk, /^pressure gauge$/i)) return true;
      if (!has(sdk, /^poisoned fish food$/i)) {
        if (!has(sdk, /^fish food$/i)) {
          if (!(await pickupFishFoodL1())) return false;
        }
        if (!(await climbManorTo(0))) return false;
        if (!has(sdk, /^poison$/i)) {
          const wp = await bot.walkTo(3097, 3366, 2);
          if (!wp?.success) {
            await openNearbyDoors(c, 3103, 3363, 2);
            await openNearbyDoors(c, 3099, 3366, 2);
            await bot.walkTo(3097, 3366, 2);
          }
          if (!(await pickupWithWait(c, 3097, 3366, /^poison$/i, 15))) return false;
        }
        if (!(await combineItems(c, /^poison$/i, /^fish food$/i, /^poisoned fish food$/i))) return false;
      } else {
        if (!(await climbManorTo(0))) return false;
      }

      if (!has(sdk, /^spade|key|rubber tube$/i)) {
        const ws = await bot.walkTo(3120, 3359, 2);
        if (!ws?.success) {
          await openNearbyDoors(c, 3119, 3356, 2);
          await bot.walkTo(3120, 3359, 2);
        }
        await pickupWithWait(c, 3120, 3359, /^spade$/i, 15);
      }

      const wf = await bot.walkTo(3088, 3335, 2);
      if (!wf?.success) {
        await openNearbyDoors(c, 3123, 3360, 2);
        await openNearbyDoors(c, 3101, 3371, 2);
        await bot.walkTo(3088, 3335, 2);
      }
      if (has(sdk, /^poisoned fish food$/i)) {
        await bot.useItemOnLoc(/^poisoned fish food$/i, /^fountain$/i);
        await waitCond(() => !has(sdk, /^poisoned fish food$/i), 6000, 300);
        await sleep(3000);
      }
      for (let i = 0; i < 3 && !has(sdk, /^pressure gauge$/i); i++) {
        await bot.interactLoc(/^fountain$/i, /^search$/i);
        await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 3000, 250);
        await chat(c);
        if (await waitInv(sdk, /^pressure gauge$/i, 3000)) return true;
      }
      return has(sdk, /^pressure gauge$/i);
    });

    const tube = () => step(c, N, 'rubber-tube', async () => {
      if (questComplete || has(sdk, /^rubber tube$/i)) return true;
      if (!(await climbManorTo(0))) return false;
      if (!has(sdk, /^key$/i)) {
        if (!has(sdk, /^spade$/i)) {
          await enterManorL0();
          const ws = await bot.walkTo(3120, 3359, 2);
          if (!ws?.success) { await openNearbyDoors(c, 3119, 3356, 2); await bot.walkTo(3120, 3359, 2); }
          if (!(await pickupWithWait(c, 3120, 3359, /^spade$/i, 15))) return false;
        }
        const wc = await bot.walkTo(3086, 3361, 2);
        if (!wc?.success) {
          await openNearbyDoors(c, 3123, 3360, 2);
          await openNearbyDoors(c, 3101, 3371, 2);
          await bot.walkTo(3086, 3361, 2);
        }
        for (let i = 0; i < 3 && !has(sdk, /^key$/i); i++) {
          await bot.useItemOnLoc(/^spade$/i, /^compost heap$/i);
          if (await waitInv(sdk, /^key$/i, 5000)) break;
        }
        if (!has(sdk, /^key$/i)) return false;
      }

      await enterManorL0();
      const wd = await bot.walkTo(3107, 3367, 1);
      if (!wd?.success) {
        await openNearbyDoors(c, 3106, 3368, 2);
        await openNearbyDoors(c, 3103, 3363, 2);
        await bot.walkTo(3107, 3367, 1);
      }
      for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 0) < 3108; i++) {
        const cd = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 131);
        if (cd) await bot.useItemOnLoc(/^key$/i, cd);
        if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) >= 3108, 4000, 300)) break;
      }
      if ((sdk.getState()?.player?.worldX ?? 0) < 3108) return false;

      await walkInRoom(3111, 3367, 1, 4000);
      await pickupWithWait(c, 3111, 3367, /^rubber tube$/i, 15);

      for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 0) >= 3108; i++) {
        await walkInRoom(3108, 3367, 0, 4000);
        const cd = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 131);
        if (cd) await bot.useItemOnLoc(/^key$/i, cd);
        if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) <= 3107, 4000, 300)) break;
      }
      return has(sdk, /^rubber tube$/i);
    });

    const oilCan = () => step(c, N, 'oil-can', async () => {
      if (questComplete || has(sdk, /^oil can$/i)) return true;
      const inBasement = () => (sdk.getState()?.player?.worldZ ?? 0) > 9700;

      if (!inBasement()) {
        if (!(await climbManorTo(0))) return false;
        await enterManorL0();
        const p = sdk.getState()?.player;
        if (!p || p.worldX >= 3097) {
          const wb = await bot.walkTo(3098, 3358, 1);
          if (!wb?.success) {
            await openNearbyDoors(c, 3103, 3363, 2);
            await openNearbyDoors(c, 3099, 3366, 2);
            await bot.walkTo(3098, 3358, 1);
          }
          for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 3098) >= 3097; i++) {
            const bc = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 155 || l.id === 156);
            if (bc) await bot.interactLoc(bc, /^search$/i);
            else await bot.interactLoc(/^bookcase$/i, /^search$/i);
            if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 3098) <= 3096, 4000, 300)) break;
          }
        }
        for (let i = 0; i < 3 && !inBasement(); i++) {
          await walkInRoom(3093, 3362, 1, 4000);
          const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 133);
          if (lad) await bot.interactLoc(lad, /climb-?down/i);
          else await bot.interactLoc(/^ladder$/i, /climb-?down/i);
          if (await waitCond(() => inBasement(), 5000, 300)) break;
        }
      }
      if (!inBasement()) return false;

      // Reset levers by climbing up and back down if we aren't starting cleanly at the ladder
      await walkInRoom(3116, 9754, 1, 5000);
      const ladUp = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 132);
      if (ladUp) {
        await bot.interactLoc(ladUp, /climb-?up/i);
        if (await waitCond(() => !inBasement(), 5000, 300)) {
          const ladDown = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 133);
          if (ladDown) await bot.interactLoc(ladDown, /climb-?down/i);
          await waitCond(() => inBasement(), 5000, 300);
        }
      }

      const pullLever = async (leverId: number, sx: number, sz: number) => {
        for (let i = 0; i < 3; i++) {
          await walkInRoom(sx, sz, 1, 5000);
          const beforeTick = Math.max(0, ...(sdk.getState()?.gameMessages ?? []).map((m: any) => m.observationId ?? 0));
          const lev = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === leverId);
          if (lev) await bot.interactLoc(lev, /^pull$/i);
          const clunk = await waitCond(() =>
            (sdk.getState()?.gameMessages ?? []).some((m: any) => (m.observationId ?? 0) > beforeTick && /clunk|pull lever/i.test(m.text)),
            3500, 250
          );
          if (clunk) { await sleep(400); return true; }
        }
        return false;
      };

      const passDoor = async (doorId: number, sx: number, sz: number, pred: () => boolean) => {
        for (let i = 0; i < 4 && !pred(); i++) {
          await walkInRoom(sx, sz, 0, 5000);
          const d = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === doorId);
          if (d) await bot.interactLoc(d, /^open$/i);
          if (await waitCond(pred, 4000, 250)) { await sleep(300); return true; }
        }
        return pred();
      };

      // 1. Pull Lever B (147) and Lever A (146)
      await pullLever(147, 3117, 9752);
      await walkInRoom(3112, 9751, 1, 5000);
      await pullLever(146, 3108, 9746);

      // 2. Open 4to7 (144 at 3108,9758) -> enter NE room (z >= 9758)
      await walkInRoom(3108, 9753, 1, 5000);
      if (!(await passDoor(144, 3108, 9757, () => (sdk.getState()?.player?.worldZ ?? 0) >= 9758))) return false;

      // 3. Pull Lever D (149 at 3108,9767)
      await pullLever(149, 3108, 9766);

      // 4. Open 4to5 (139 at 3105,9760) -> enter Room 5 (x <= 3104)
      if (!(await passDoor(139, 3105, 9760, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3104))) return false;

      // 5. Open 5to8 (145 at 3102,9758) -> enter Room 8 (z <= 9757)
      if (!(await passDoor(145, 3102, 9758, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 9757))) return false;

      // 6. Pull Lever A (146) and Lever B (147) back up
      await walkInRoom(3106, 9752, 1, 5000);
      await pullLever(146, 3108, 9746);
      await walkInRoom(3112, 9751, 1, 5000);
      await pullLever(147, 3117, 9752);

      // 7. Re-enter Room 5 via 5to8 (145 at 3102,9758)
      await walkInRoom(3106, 9752, 1, 5000);
      if (!(await passDoor(145, 3102, 9757, () => (sdk.getState()?.player?.worldZ ?? 0) >= 9758))) return false;

      // 8. Open 5to6 (140 at 3100,9760) -> enter Room 6 (x <= 3099)
      if (!(await passDoor(140, 3100, 9760, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3099))) return false;

      // 9. Open 3to6 (143 at 3097,9763) -> enter Room 3 (z >= 9763)
      if (!(await passDoor(143, 3097, 9762, () => (sdk.getState()?.player?.worldZ ?? 0) >= 9763))) return false;

      // 10. Pull Lever E (150 at 3097,9767) and Lever F (151 at 3096,9765)
      await pullLever(150, 3097, 9766);
      await pullLever(151, 3097, 9765);

      // 11. Open 2to3 (138 at 3100,9765) -> enter Room 2 (x >= 3100)
      if (!(await passDoor(138, 3099, 9765, () => (sdk.getState()?.player?.worldX ?? 0) >= 3100))) return false;

      // 12. Open 1to2 (137 at 3105,9765) -> enter Room 1 (x >= 3105)
      if (!(await passDoor(137, 3104, 9765, () => (sdk.getState()?.player?.worldX ?? 0) >= 3105))) return false;

      // 13. Pull Lever C (148 at 3112,9760)
      await pullLever(148, 3111, 9760);

      // 14. Go back through 1to2 (137) and 2to3 (138) into Room 3
      if (!(await passDoor(137, 3105, 9765, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3104))) return false;
      if (!(await passDoor(138, 3100, 9765, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3099))) return false;

      // 15. Pull Lever E (150 at 3097,9767) back up
      await pullLever(150, 3097, 9766);

      // 16. Open 2to3 (138) -> Room 2, 2to5 (142 at 3102,9763) -> Room 5, 5to8 (145 at 3102,9758) -> Room 8, 8to9 (141 at 3100,9755) -> Room 9
      if (!(await passDoor(138, 3099, 9765, () => (sdk.getState()?.player?.worldX ?? 0) >= 3100))) return false;
      if (!(await passDoor(142, 3102, 9763, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 9762))) return false;
      if (!(await passDoor(145, 3102, 9758, () => (sdk.getState()?.player?.worldZ ?? 9999) <= 9757))) return false;
      if (!(await passDoor(141, 3100, 9755, () => (sdk.getState()?.player?.worldX ?? 9999) <= 3099))) return false;

      // 17. Pick up Oil can at (3092, 9755)
      await walkInRoom(3093, 9755, 1, 5000);
      await pickupWithWait(c, 3092, 9755, /^oil can$/i, 15);

      // 18. Exit Room 9 via 8to9 (141) and climb up puzzle_ladder (132 at 3117,9754), then pull secret room lever (160 at 3096,3357)
      await passDoor(141, 3099, 9755, () => (sdk.getState()?.player?.worldX ?? 0) >= 3100);
      await walkInRoom(3106, 9752, 1, 5000);
      await walkInRoom(3116, 9754, 1, 5000);
      for (let i = 0; i < 3 && inBasement(); i++) {
        const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 132);
        if (lad) await bot.interactLoc(lad, /climb-?up/i);
        else await bot.interactLoc(/^ladder$/i, /climb-?up/i);
        if (await waitCond(() => !inBasement(), 5000, 300)) break;
      }
      for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 0) <= 3096; i++) {
        await walkInRoom(3096, 3357, 0, 4000);
        const lev = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 160);
        if (lev) await bot.interactLoc(lev, /^pull$/i);
        else await bot.interactLoc(/^lever$/i, /^pull$/i);
        if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) >= 3098, 5000, 300)) break;
      }

      return has(sdk, /^oil can$/i);
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (questComplete) return true;
      if (!(await walkToOddensteinL2())) return false;
      const coinsBefore = count(sdk, /^coins$/i);
      await talk(c, /^professor oddenstein$/i);
      // Wait for the 6-tick machine cutscene to open Ernest's thank-you dialog
      if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 7000, 300)) {
        await chat(c);
      }
      const done = await waitCond(
        () => !has(sdk, /^oil can$/i) && !has(sdk, /^pressure gauge$/i) && !has(sdk, /^rubber tube$/i) && count(sdk, /^coins$/i) >= coinsBefore + 300,
        6000, 300
      );
      await bot.closeInterface();
      await climbManorTo(0);
      return done;
    });

    return (await start()) && (await gauge()) && (await tube()) && (await oilCan()) && (await handIn());
  },
};
