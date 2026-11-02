import { Ctx, Quest, has, count, lvl, log, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, pickupWithWait, combineItems, bankJunk, withdrawFromDraynorBank, walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround } from '../quest-kit';
const N = 'Prince Ali Rescue';

const KEEP_RE = /^(coins|shears|bronze pickaxe|bronze axe|tinderbox|logs|ashes|bucket|bucket of water|pot|pot of flour|grain|redberries|paste|onion|yellow dye|wool|ball of wool|wig|rope|clay|soft clay|key print|copper ore|tin ore|bronze bar|bronze key|pink skirt|beer)$/i;

export const prince: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let started = false;
    let osmanKeyGiven = false;
    let leelaReady = false;
    let princeSaved = false;
    let questComplete = false;

    const hasBlondeWig = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 2419);
    const hasPlainWig = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 2421);

    const walkToAlKharid = async (x: number, z: number) => {
      const p0 = sdk.getState()?.player;
      if (p0 && sdk.getState()?.dialog?.isOpen) {
        await sdk.sendWalk(p0.worldX, p0.worldZ, true);
        await sleep(600);
      }
      if ((sdk.getState()?.player?.worldX ?? 0) < 3268) {
        if (count(sdk, /^coins$/i) >= 20 || princeSaved || questComplete) {
          await bot.walkTo(3267, 3227, 1);
          const gate = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2882 || l.id === 2883);
          if (gate) {
            await sdk.sendInteractLoc(gate.x, gate.z, gate.id, 1);
            if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 4000, 250)) {
              await chat(c, [/yes, ok/i]);
              await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) >= 3268, 6000, 300);
              await sleep(1200);
            }
          }
        }
        if ((sdk.getState()?.player?.worldX ?? 0) < 3268) {
          await bot.walkTo(3260, 3260, 3);
          await bot.walkTo(3263, 3300, 3);
          await bot.walkTo(3268, 3332, 2);
          await bot.walkTo(3283, 3332, 2);
          await bot.walkTo(3285, 3290, 3);
          await bot.walkTo(3292, 3240, 3);
        }
      }
      const w = await bot.walkTo(x, z, 2);
      if (!w?.success) { await openNearbyDoors(c, x, z, 2); await bot.walkTo(x, z, 2); }
      return true;
    };

    const walkFromAlKharid = async (x: number, z: number) => {
      const p0 = sdk.getState()?.player;
      if (p0 && sdk.getState()?.dialog?.isOpen) {
        await sdk.sendWalk(p0.worldX, p0.worldZ, true);
        await sleep(600);
      }
      if ((sdk.getState()?.player?.worldX ?? 0) >= 3268 && (sdk.getState()?.player?.worldZ ?? 0) < 3330) {
        if (count(sdk, /^coins$/i) >= 20 || princeSaved || questComplete) {
          await bot.walkTo(3268, 3227, 1);
          const gate = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2882 || l.id === 2883);
          if (gate) {
            await sdk.sendInteractLoc(gate.x, gate.z, gate.id, 1);
            if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 4000, 250)) {
              await chat(c, [/yes, ok/i]);
              await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) < 3268, 6000, 300);
              await sleep(1200);
            }
          }
        }
        if ((sdk.getState()?.player?.worldX ?? 0) >= 3268) {
          await bot.walkTo(3292, 3240, 3);
          await bot.walkTo(3285, 3290, 3);
          await bot.walkTo(3283, 3332, 2);
          await bot.walkTo(3268, 3332, 2);
          await bot.walkTo(3263, 3300, 3);
          await bot.walkTo(3260, 3260, 3);
        }
      }
      const w = await bot.walkTo(x, z, 2);
      if (!w?.success) { await openNearbyDoors(c, x, z, 2); await bot.walkTo(x, z, 2); }
      return true;
    };

    const mineRock = async (x: number, z: number, rockIds: number[], itemRe: RegExp) => {
      if (has(sdk, itemRe)) return true;
      await bot.walkTo(x, z, 2);
      for (let i = 0; i < 8 && !has(sdk, itemRe); i++) {
        const rock = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => rockIds.includes(l.id) && (l.options ?? []).some((o: string) => /^mine$/i.test(o)));
        if (!rock) { await sleep(1500); continue; }
        await bot.interactLoc(rock, 'Mine');
        if (await waitInv(sdk, itemRe, 8000)) return true;
      }
      return has(sdk, itemRe);
    };

    const ensureCoins = async (minCoins: number, x = 3100, z = 3250) => {
      while (count(sdk, /^coins$/i) < minCoins) {
        const npc = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^(man|woman)$/i.test(n.name) && n.combatLevel <= 4 && n.reachable !== false);
        if (!npc) {
          await bot.walkTo(x, z, 4);
          await sleep(600);
          continue;
        }
        await bot.pickpocketNpc(npc);
        await sleep(600);
      }
    };

    const start = () => step(c, N, 'start-hassan-osman', async () => {
      if (started || has(sdk, /^key print|bronze key|paste|wig$/i) || osmanKeyGiven || princeSaved || questComplete) return true;
      await exitWizardsTowerGround(c);
      if ((sdk.getState()?.player?.worldX ?? 0) < 3268) {
        await bankJunk(c, KEEP_RE);
        await withdrawFromDraynorBank(c, [
          /^coins$/i, /^bronze pickaxe$/i, /^bronze axe$/i, /^tinderbox$/i, /^bucket$/i, /^pot$/i, /^shears$/i,
          /^soft clay$/i, /^key print$/i, /^bronze bar$/i, /^bronze key$/i, /^pink skirt$/i, /^beer$/i, /^redberries$/i, /^paste$/i, /^yellow dye$/i, /^wig$/i, /^rope$/i,
        ]);
        if (has(sdk, /^key print|bronze key|paste|wig$/i)) return true;
        await ensureCoins(70, 3100, 3250);
      }
      await walkToAlKharid(3298, 3163);
      if (!(await talk(c, /^hassan$/i, [/can i help you/i]))) return false;
      const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/friend of the town of al-kharid|eternal gratitude of the emir/i.test(recent)) { questComplete = true; return true; }
      if (/getting on well with the rescue/i.test(recent)) { started = true; osmanKeyGiven = true; return true; }
      await bot.walkTo(3286, 3180, 2);
      if (!(await talk(c, /^osman$/i, [/okay, i better go/i, /second thing you need/i, /what i still need/i]))) return false;
      const osmanRecent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (!/good luck travel with you|find leela|what i still need|well on the way|safe and on his way/i.test(osmanRecent)) return false;
      started = true;
      return true;
    });

    const varrockTrip = () => step(c, N, 'varrock-items', async () => {
      if (questComplete || princeSaved) return true;
      const needClay = !has(sdk, /^soft clay|key print|bronze key$/i) && !osmanKeyGiven;
      const needBar = !has(sdk, /^bronze bar|bronze key$/i) && !(has(sdk, /^copper ore$/i) && has(sdk, /^tin ore$/i)) && !osmanKeyGiven;
      const needSkirt = !has(sdk, /^pink skirt$/i);
      const needBeer = count(sdk, /^beer$/i) < 3 && !leelaReady;
      const needBerries = !has(sdk, /^redberries|paste$/i);
      if (!needClay && !needBar && !needSkirt && !needBeer && !needBerries) return true;

      await walkFromAlKharid(3212, 3240);
      if (!has(sdk, /^bronze pickaxe$/i) && (needClay || needBar)) {
        await withdrawFromDraynorBank(c, [/^bronze pickaxe$/i]);
      }
      if (!has(sdk, /^bucket|bucket of water$/i)) {
        await withdrawFromDraynorBank(c, [/^bucket$/i]);
        if (!has(sdk, /^bucket|bucket of water$/i)) await pickupWithWait(c, 3216, 3291, /^bucket$/i, 15);
      }

      if (needClay && !has(sdk, /^clay$/i)) {
        if (!(await walkToVarrock(c, 3180, 3371))) return false;
        if (!(await mineRock(3180, 3371, [2108, 2109], /^clay$/i))) return false;
      }

      if (needSkirt) {
        if (!(await walkToVarrock(c, 3205, 3417))) return false;
        await ensureCoins(40, 3222, 3430);
        const w = await bot.walkTo(3205, 3417, 2);
        if (!w?.success) { await openNearbyDoors(c, 3208, 3417, 2); await bot.walkTo(3205, 3417, 2); }
        for (let i = 0; i < 3 && !has(sdk, /^pink skirt$/i); i++) {
          const o = await bot.openShop(/^thessalia$/i);
          if (o?.success) {
            await bot.buyFromShop(/^pink skirt$/i, 1);
            await bot.closeShop();
          }
          await sleep(600);
        }
        if (!has(sdk, /^pink skirt$/i)) return false;
      }

      if (needClay && !has(sdk, /^soft clay$/i)) {
        if (!has(sdk, /^bucket of water$/i)) {
          await bot.walkTo(3237, 3434, 2);
          await bot.useItemOnLoc(/^bucket$/i, /^fountain$/i);
          if (!(await waitInv(sdk, /^bucket of water$/i, 5000))) return false;
        }
        if (!(await combineItems(c, /^bucket of water$/i, /^clay$/i, /^soft clay$/i))) return false;
      }

      if (needBeer) {
        if (!(await walkToVarrock(c, 3226, 3399))) return false;
        const w = await bot.walkTo(3226, 3399, 2);
        if (!w?.success) { await openNearbyDoors(c, 3226, 3399, 2); await bot.walkTo(3226, 3399, 2); }
        for (let i = 0; i < 6 && count(sdk, /^beer$/i) < 3; i++) {
          const before = count(sdk, /^beer$/i);
          await talk(c, /^bartender$/i, [/glass of your finest ale/i]);
          await waitCond(() => count(sdk, /^beer$/i) > before, 4000, 300);
        }
        if (count(sdk, /^beer$/i) < 3) return false;
      }

      if (needBerries) {
        if (!(await walkToVarrock(c, 3267, 3371))) return false;
        if (!(await pickupWithWait(c, 3267, 3371, /^redberries$/i, 20))) return false;
      }

      if (needBar) {
        if (!has(sdk, /^copper ore$/i)) {
          if (!(await walkToVarrock(c, 3286, 3364))) return false;
          if (!(await mineRock(3286, 3364, [2090, 2091], /^copper ore$/i))) return false;
        }
        if (!has(sdk, /^tin ore$/i)) {
          if (!(await walkToVarrock(c, 3283, 3365))) return false;
          if (!(await mineRock(3283, 3365, [2094, 2095], /^tin ore$/i))) return false;
        }
      }

      return true;
    });

    const aggieItems = () => step(c, N, 'aggie-paste-and-dye', async () => {
      if (questComplete || princeSaved) return true;
      const needPaste = !has(sdk, /^paste$/i);
      const needDye = !has(sdk, /^yellow dye$/i) && !hasBlondeWig();
      if (!needPaste && !needDye) return true;

      if ((sdk.getState()?.player?.worldZ ?? 0) > 3350) {
        if (!(await walkFromVarrockToLumbridge(c, 3209, 3214))) return false;
      } else if ((sdk.getState()?.player?.worldX ?? 0) >= 3268) {
        await walkFromAlKharid(3209, 3214);
      }

      let fireCoord: [number, number] | null = null;
      if (needPaste && !has(sdk, /^ashes$/i)) {
        if (!has(sdk, /^tinderbox$/i) || !has(sdk, /^bronze axe$/i)) {
          await withdrawFromDraynorBank(c, [/^tinderbox$/i, /^bronze axe$/i]);
        }
        await bot.walkTo(3164, 3290, 2);
        for (let i = 0; i < 4 && !has(sdk, /^logs$/i); i++) {
          await bot.chopTree(/^tree$/i);
        }
        const fireTiles: [number, number][] = [[3164, 3290], [3165, 3290], [3163, 3290], [3164, 3289]];
        for (const [fx, fz] of fireTiles) {
          if (!has(sdk, /^logs$/i)) break;
          await bot.walkTo(fx, fz, 0);
          const px = sdk.getState()?.player?.worldX ?? fx;
          const pz = sdk.getState()?.player?.worldZ ?? fz;
          const b = await bot.burnLogs(/^logs$/i);
          if (b?.success && (b.xpGained ?? 0) > 0) {
            fireCoord = [px, pz];
            log(c, `lit fire at (${px},${pz})`);
            break;
          }
        }
      }

      if (needPaste && !has(sdk, /^pot of flour$/i)) {
        if (!has(sdk, /^pot$/i)) {
          await bot.walkTo(3209, 3214, 2);
          if (!(await pickupWithWait(c, 3209, 3214, /^pot$/i, 15))) return false;
        }
        const wm0 = await bot.walkTo(3166, 3306, 2);
        if (!wm0?.success) { await openNearbyDoors(c, 3166, 3303, 2); await bot.walkTo(3166, 3306, 2); }
        await bot.interactLoc(/flour bin/i, 'Empty');
        await waitInv(sdk, /^pot of flour$/i, 2500);
        if (!has(sdk, /^pot of flour$/i)) {
          if (!has(sdk, /^grain$/i)) {
            const w = await bot.walkTo(3161, 3296, 2);
            if (!w?.success) { await openNearbyDoors(c, 3163, 3289, 2); await bot.walkTo(3161, 3296, 2); }
            await bot.interactLoc(/^wheat$/i, 'Pick');
            if (!(await waitInv(sdk, /^grain$/i, 6000))) return false;
          }
          const wm = await bot.walkTo(3166, 3306, 2);
          if (!wm?.success) { await openNearbyDoors(c, 3166, 3303, 2); await bot.walkTo(3166, 3306, 2); }
          while (lvl(sdk) < 2) {
            const b = lvl(sdk);
            await bot.interactLoc(/^ladder$/i, 'Climb-up');
            if (!(await waitCond(() => lvl(sdk) > b, 5000))) return false;
            await sleep(1000);
          }
          if (has(sdk, /^grain$/i)) {
            await bot.useItemOnLoc(/^grain$/i, /^hopper$/i);
            await sleep(2500);
          }
          await bot.interactLoc(/hopper controls/i, 'Operate');
          await sleep(3000);
          while (lvl(sdk) > 0) {
            const b = lvl(sdk);
            await bot.interactLoc(/^ladder$/i, 'Climb-down');
            if (!(await waitCond(() => lvl(sdk) < b, 5000))) return false;
            await sleep(1000);
          }
          for (let i = 0; i < 3 && !has(sdk, /^pot of flour$/i); i++) {
            await bot.interactLoc(/flour bin/i, 'Empty');
            if (await waitInv(sdk, /^pot of flour$/i, 3500)) break;
          }
          if (!has(sdk, /^pot of flour$/i)) return false;
        }
      }

      if (needPaste && !has(sdk, /^bucket of water$/i)) {
        await bot.walkTo(3207, 3213, 2);
        await bot.useItemOnLoc(/^bucket$/i, /^sink$/i);
        if (!(await waitInv(sdk, /^bucket of water$/i, 5000))) return false;
      }

      if (needDye && count(sdk, /^onion$/i) < 2) {
        const w = await bot.walkTo(3188, 3266, 2);
        if (!w?.success) { await openNearbyDoors(c, 3186, 3268, 2); await bot.walkTo(3188, 3266, 2); }
        for (let i = 0; i < 6 && count(sdk, /^onion$/i) < 2; i++) {
          const before = count(sdk, /^onion$/i);
          await bot.interactLoc(/^onion$/i, 'Pick');
          await waitCond(() => count(sdk, /^onion$/i) > before, 4000, 300);
        }
        if (count(sdk, /^onion$/i) < 2) return false;
      }

      if (needPaste && !has(sdk, /^ashes$/i)) {
        if (fireCoord) {
          await pickupWithWait(c, fireCoord[0], fireCoord[1], /^ashes$/i, 125);
        }
        if (!has(sdk, /^ashes$/i)) {
          await bot.walkTo(3095, 3260, 2);
          for (let i = 0; i < 4 && !has(sdk, /^logs$/i); i++) await bot.chopTree(/^tree$/i);
          await bot.walkTo(3095, 3260, 0);
          const px = sdk.getState()?.player?.worldX ?? 3095;
          const pz = sdk.getState()?.player?.worldZ ?? 3260;
          await bot.burnLogs(/^logs$/i);
          if (!(await pickupWithWait(c, px, pz, /^ashes$/i, 130))) return false;
        }
      }

      const wa = await bot.walkTo(3086, 3259, 2);
      if (!wa?.success) { await openNearbyDoors(c, 3088, 3259, 2); await bot.walkTo(3086, 3259, 2); }
      if (needPaste) {
        await talk(c, /^aggie$/i, [/make skin paste/i, /mix me some skin paste/i]);
        if (!(await waitInv(sdk, /^paste$/i, 4000))) { started = false; return false; }
      }
      if (needDye) {
        await ensureCoins(5, 3095, 3260);
        await talk(c, /^aggie$/i, [/make dyes for me/i, /yellow dye/i, /make me some yellow dye/i]);
        if (!(await waitInv(sdk, /^yellow dye$/i, 4000))) return false;
      }
      return true;
    });

    const shearAndSpin = async (targetBalls: number) => {
      if (count(sdk, /^ball of wool$/i) >= targetBalls) return true;
      if (!has(sdk, /^shears$/i)) {
        await withdrawFromDraynorBank(c, [/^shears$/i]);
        if (!has(sdk, /^shears$/i)) {
          const wf = await bot.walkTo(3190, 3272, 2);
          if (!wf?.success) { await openNearbyDoors(c, 3189, 3275, 2); await bot.walkTo(3190, 3272, 2); }
          if (!(await pickupWithWait(c, 3192, 3272, /^shears$/i, 15))) return false;
        }
      }
      while (count(sdk, /^wool$/i) + count(sdk, /^ball of wool$/i) < targetBalls) {
        const p = sdk.getState()?.player;
        if (!p || p.worldX < 3193 || p.worldX > 3212 || p.worldZ < 3257 || p.worldZ > 3276) {
          const w = await bot.walkTo(3201, 3268, 3);
          if (!w?.success) { await openNearbyDoors(c, 3213, 3262, 2); await bot.walkTo(3201, 3268, 3); }
        }
        const sheep = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^sheep$/i.test(n.name) && n.combatLevel === 0 && n.x >= 3193 && n.x <= 3212 && n.z >= 3257 && n.z <= 3276);
        if (!sheep) { await bot.walkTo(3201, 3268, 2); await sleep(1000); continue; }
        const before = count(sdk, /^wool$/i);
        await bot.useItemOnNpc(/^shears$/i, sheep);
        await waitCond(() => count(sdk, /^wool$/i) > before, 3500);
      }
      if (count(sdk, /^wool$/i) > 0) {
        await bot.walkTo(3205, 3209, 2);
        if (!(await lumbridgeStairs(c, 1))) return false;
        const ws = await bot.walkTo(3209, 3213, 2);
        if (!ws?.success) { await openNearbyDoors(c, 3207, 3214, 2); await bot.walkTo(3209, 3213, 2); }
        for (let g = 0; g < 15 && count(sdk, /^wool$/i) > 0; g++) {
          const before = count(sdk, /^ball of wool$/i);
          await bot.useItemOnLoc(/^wool$/i, /^spinning wheel$/i);
          await waitCond(() => count(sdk, /^ball of wool$/i) > before, 4000);
        }
        await lumbridgeStairs(c, 0);
      }
      return count(sdk, /^ball of wool$/i) >= targetBalls;
    };

    const nedWigAndRope = () => step(c, N, 'ned-wig-and-rope', async () => {
      if (questComplete || princeSaved) return true;
      const needWig = !hasBlondeWig();
      const needRope = !has(sdk, /^rope$/i) && !leelaReady;
      if (!needWig && !needRope) return true;

      if ((sdk.getState()?.player?.worldX ?? 0) >= 3268) {
        await walkFromAlKharid(3095, 3245);
      }
      await bankJunk(c, /^(coins|shears|soft clay|key print|copper ore|tin ore|bronze bar|bronze key|pink skirt|beer|paste|yellow dye|wool|ball of wool|wig|rope)$/i);

      if (needWig) {
        if (!hasPlainWig()) {
          if (!(await shearAndSpin(3))) return false;
          const wn = await bot.walkTo(3100, 3258, 2);
          if (!wn?.success) { await openNearbyDoors(c, 3101, 3258, 2); await bot.walkTo(3100, 3258, 2); }
          await talk(c, /^ned$/i, [/other things from wool/i, /sort of a wig/i, /make me a wig/i]);
          if (!(await waitCond(() => hasPlainWig(), 4000))) return false;
        }
        await combineItems(c, /^yellow dye$/i, /^wig$/i, /^wig$/i);
        if (!(await waitCond(() => hasBlondeWig(), 4000))) return false;
      }

      if (needRope) {
        if (!(await shearAndSpin(4))) return false;
        const wn = await bot.walkTo(3100, 3258, 2);
        if (!wn?.success) { await openNearbyDoors(c, 3101, 3258, 2); await bot.walkTo(3100, 3258, 2); }
        await talk(c, /^ned$/i, [/would like some rope/i, /balls of wool.*make me some rope/i]);
        if (!(await waitInv(sdk, /^rope$/i, 4000))) return false;
      }

      return true;
    });

    const keliOsmanLeela = () => step(c, N, 'keli-osman-leela', async () => {
      if (questComplete || princeSaved || leelaReady) return true;
      if (!has(sdk, /^key print|bronze key$/i) && !osmanKeyGiven) {
        if ((sdk.getState()?.player?.worldX ?? 0) >= 3268) await walkFromAlKharid(3128, 3244);
        const wk = await bot.walkTo(3128, 3244, 2);
        if (!wk?.success) { await openNearbyDoors(c, 3128, 3246, 2); await bot.walkTo(3128, 3244, 2); }
        await talk(c, /^lady keli$/i, [/famous in runescape/i, /latest plan/i, /not try to get him out/i, /see the key please/i, /touch the key/i]);
        if (!(await waitInv(sdk, /^key print$/i, 4000))) return false;
      }

      if (has(sdk, /^key print$/i)) {
        if (!has(sdk, /^bronze bar$/i)) {
          await walkToAlKharid(3275, 3186);
          const wf = await bot.walkTo(3275, 3186, 2);
          if (!wf?.success) { await openNearbyDoors(c, 3277, 3185, 2); await bot.walkTo(3275, 3186, 2); }
          for (let i = 0; i < 3 && !has(sdk, /^bronze bar$/i); i++) {
            await bot.useItemOnLoc(/^copper ore$/i, /^furnace$/i);
            if (await waitInv(sdk, /^bronze bar$/i, 6000)) break;
          }
          if (!has(sdk, /^bronze bar$/i)) return false;
        }
        await walkToAlKharid(3286, 3180);
        await talk(c, /^osman$/i, [/thank you/i]);
        if (!(await waitCond(() => !has(sdk, /^key print$/i), 4000))) return false;
        osmanKeyGiven = true;
      }

      await walkFromAlKharid(3113, 3263);
      if (!has(sdk, /^bronze key$/i)) {
        await talk(c, /^leela$/i, [/haven't spoken to him yet/i]);
        if (!(await waitInv(sdk, /^bronze key$/i, 4000))) return false;
      }
      leelaReady = true;
      return has(sdk, /^bronze key$/i);
    });

    const rescueAndFinish = () => step(c, N, 'rescue-and-finish', async () => {
      if (questComplete) return true;
      if (!princeSaved) {
        const wj = await bot.walkTo(3124, 3245, 2);
        if (!wj?.success) { await openNearbyDoors(c, 3128, 3246, 2); await bot.walkTo(3124, 3245, 2); }
        if (count(sdk, /^beer$/i) >= 3) {
          await talk(c, /^joe$/i, [/have some beer here, fancy one/i]);
          if (!(await waitCond(() => count(sdk, /^beer$/i) === 0, 6000))) return false;
        }
        if (has(sdk, /^rope$/i)) {
          for (let i = 0; i < 4 && has(sdk, /^rope$/i); i++) {
            const keli = sdk.findNearbyNpc(/^lady keli$/i);
            if (!keli) break;
            await bot.useItemOnNpc(/^rope$/i, keli);
            await sleep(1200);
            if (sdk.getState()?.dialog?.isOpen) await chat(c);
          }
          if (has(sdk, /^rope$/i)) return false;
        }
        await bot.walkTo(3123, 3244, 0);
        for (let i = 0; i < 4 && (sdk.getState()?.player?.worldZ ?? 3244) > 3243; i++) {
          await bot.useItemOnLoc(/^bronze key$/i, /^prison gate$/i);
          await waitCond(() => (sdk.getState()?.player?.worldZ ?? 3244) <= 3243, 4000, 300);
        }
        await talk(c, /^prince ali$/i);
        if (!(await waitCond(() => !has(sdk, /^pink skirt$/i), 5000))) return false;
        princeSaved = true;
        if ((sdk.getState()?.player?.worldZ ?? 3244) <= 3243) {
          await bot.interactLoc(/^prison gate$/i, 'Open');
          await waitCond(() => (sdk.getState()?.player?.worldZ ?? 3242) > 3243, 4000, 300);
        }
      }

      const coinsBefore = sdk.findInventoryItem(/^coins$/i)?.count ?? 0;
      await walkToAlKharid(3298, 3163);
      await talk(c, /^hassan$/i);
      const done = await waitCond(() => {
        const cNow = sdk.findInventoryItem(/^coins$/i)?.count ?? 0;
        const msgs = (sdk.getState()?.gameMessages ?? []).map((m: any) => m.text).join(' ');
        return cNow >= coinsBefore + 700 || /quest complete/i.test(msgs) || !!sdk.getState()?.interface?.isOpen;
      }, 6000);
      await bot.closeInterface();
      questComplete = done;
      return done;
    });

    return (await start()) && (await varrockTrip()) && (await aggieItems()) && (await nedWigAndRope()) && (await keliOsmanLeela()) && (await rescueAndFinish());
  },
};
