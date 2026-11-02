import { Ctx, Quest, has, count, lvl, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, pickupWithWait, bankJunk, withdrawFromDraynorBank, walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround } from '../quest-kit';
const N = "Pirate's Treasure";

const KEEP_RE = /^(coins|bronze sword|wooden shield|white apron|spade|karamjan? rum|banana|chest key|pirate message|emerald|gold ring)$/i;

export const hunt: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (has(sdk, /^emerald$/i)) return true;
    let messageRead = false;

    const startAndSmuggle = () => step(c, N, 'start-and-smuggle', async () => {
      if (has(sdk, /^chest key|pirate message|emerald$/i) || messageRead) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0 && (sdk.getState()?.player?.worldX ?? 0) > 3040) await lumbridgeStairs(c, 0);

      // If we are on a ship gangplank (L1), cross off first
      if (lvl(sdk) === 1) {
        const plank = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2082 || l.id === 2084 || /^gangplank$/i.test(l.name));
        if (plank) {
          await bot.interactLoc(plank, /^cross$/i);
          await waitCond(() => lvl(sdk) === 0, 5000, 300);
        }
      }

      if ((sdk.getState()?.player?.worldX ?? 3050) >= 2980) {
        if (has(sdk, /^karamjan? rum$/i)) return true;
        await bankJunk(c, KEEP_RE);
        await withdrawFromDraynorBank(c, [/^coins$/i, /^bronze sword$/i, /^wooden shield$/i, /^white apron$/i, /^spade$/i]);
        if (has(sdk, /^bronze sword$/i)) await bot.equipItem(/^bronze sword$/i);
        if (has(sdk, /^wooden shield$/i)) await bot.equipItem(/^wooden shield$/i);

        if (count(sdk, /^coins$/i) < 95) {
          if ((sdk.getState()?.player?.worldX ?? 3092) < 3180) await bot.walkTo(3185, 3245, 3);
          await bot.walkTo(3248, 3240, 3);
          await sdk.sendSetCombatStyle(1);
          const deadline = Date.now() + 240_000;
          while (Date.now() < deadline && count(sdk, /^coins$/i) < 100) {
            await bot.dismissBlockingUI();
            const gc = sdk.findGroundItem(/^coins$/i);
            if (gc) { await bot.pickupItem(gc); await sleep(600); }
            const dag = sdk.findGroundItem(/^iron dagger$/i);
            if (dag && (sdk.getInventory()?.length ?? 0) < 25) { await bot.pickupItem(dag); await sleep(600); }
            const px = sdk.getState()?.player?.worldX ?? 3248;
            const pz = sdk.getState()?.player?.worldZ ?? 3240;
            if (Math.hypot(px - 3248, pz - 3240) > 18) await bot.walkTo(3248, 3240, 3);
            const gob = (sdk.getState()?.nearbyNpcs ?? [])
              .filter((n: any) => /^goblin$/i.test(n.name) && n.combatLevel <= 5 && n.x >= 3242 && n.x <= 3260 && n.z >= 3225 && n.z <= 3252)
              .sort((a: any, b: any) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
            if (gob && !sdk.getState()?.player?.combat?.inCombat) await bot.attack(gob);
            await sleep(700);
          }
          if (count(sdk, /^coins$/i) < 95 && has(sdk, /^iron dagger$/i)) {
            await bot.walkTo(3212, 3246, 2);
            const o = await bot.openShop(/^shop keeper$/i);
            if (o?.success) {
              await bot.sellToShop(/^iron dagger$/i, 'all');
              await bot.closeShop();
            }
          }
        }

        const wearingApron = () => (sdk.getState()?.equipment ?? []).some((e: any) => /^white apron$/i.test(e.name));
        if (!has(sdk, /^white apron$/i) && !wearingApron()) {
          if (!(await walkToVarrock(c, 3206, 3416))) return false;
          const wt = await bot.walkTo(3206, 3416, 2);
          if (!wt?.success) { await openNearbyDoors(c, 3208, 3416, 3); await bot.walkTo(3206, 3416, 2); }
          for (let i = 0; i < 3 && !has(sdk, /^white apron$/i); i++) {
            const o = await bot.openShop(/^thessalia$/i);
            if (o?.success) {
              await bot.buyFromShop(/^white apron$/i, 1);
              await bot.closeShop();
            }
            await sleep(500);
          }
          if (!has(sdk, /^white apron$/i)) return false;
          await walkFromVarrockToLumbridge(c, 3110, 3250);
        }

        await bot.walkTo(3053, 3250, 2);
        await talk(c, /^redbeard frank$/i, [/in search of treasure/i]);

        // Sail to Karamja
        await bot.walkTo(3027, 3218, 2);
        await talk(c, /^(captain tobias|seaman lorris|seaman thresnor)$/i, [/yes please/i]);
        await waitCond(() => (sdk.getState()?.player?.worldX ?? 3027) < 2970, 12_000, 400);
        await sleep(800);
        await chat(c);
        for (let i = 0; i < 3 && lvl(sdk) === 1; i++) {
          const plank = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2082 || /^gangplank$/i.test(l.name));
          if (plank) await bot.interactLoc(plank, /^cross$/i);
          if (await waitCond(() => lvl(sdk) === 0, 5000, 300)) break;
        }
      }

      if ((sdk.getState()?.player?.worldX ?? 3050) < 2970) {
        const fillBananaCrateForLuthas = async (withRum: boolean) => {
          const wl = await bot.walkTo(2939, 3154, 2);
          if (!wl?.success) { await openNearbyDoors(c, 2939, 3152, 2); await bot.walkTo(2939, 3154, 2); }
          await talk(c, /^luthas$/i, [/offer me employment/i]);

          if (count(sdk, /^banana$/i) < 10) {
            await bot.walkTo(2918, 3161, 3);
            for (let i = 0; i < 20 && count(sdk, /^banana$/i) < 10; i++) {
              const before = count(sdk, /^banana$/i);
              const tree = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /^banana tree$/i.test(l.name) && (l.options ?? []).some((o: string) => /^pick$/i.test(o)));
              if (tree) {
                await bot.interactLoc(tree, /^pick$/i);
                await waitCond(() => count(sdk, /^banana$/i) > before, 3500, 250);
              } else {
                await bot.walkTo(2912, 3161, 3);
                await sleep(1000);
              }
            }
          }

          await bot.walkTo(2943, 3152, 2);
          const crate = () => (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2072);
          if (withRum && has(sdk, /^karamjan? rum$/i)) {
            const cr = crate();
            if (cr) await bot.useItemOnLoc(/^karamjan? rum$/i, cr);
            await waitCond(() => !has(sdk, /^karamjan? rum$/i) || !!sdk.getState()?.dialog?.isOpen, 4000, 250);
            await chat(c);
          }
          for (let i = 0; i < 14 && count(sdk, /^banana$/i) > 0; i++) {
            const before = count(sdk, /^banana$/i);
            const cr = crate();
            if (cr) await bot.useItemOnLoc(/^banana$/i, cr);
            await waitCond(() => count(sdk, /^banana$/i) < before || !!sdk.getState()?.dialog?.isOpen, 4000, 250);
            await chat(c);
          }

          const wl2 = await bot.walkTo(2939, 3154, 2);
          if (!wl2?.success) { await openNearbyDoors(c, 2939, 3152, 2); await bot.walkTo(2939, 3154, 2); }
          await talk(c, /^luthas$/i, [/thank you, i'll be on my way/i]);
          if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 3500, 300)) {
            await chat(c, [/thank you, i'll be on my way/i]);
          }
        };

        while (!has(sdk, /^karamjan? rum$/i) && count(sdk, /^coins$/i) < 30) {
          await fillBananaCrateForLuthas(false);
        }

        if (!has(sdk, /^karamjan? rum$/i)) {
          const wz = await bot.walkTo(2925, 3143, 2);
          if (!wz?.success) { await openNearbyDoors(c, 2925, 3143, 3); await bot.walkTo(2925, 3143, 2); }
          for (let i = 0; i < 3 && !has(sdk, /^karamjan? rum$/i); i++) {
            const o = await bot.openShop(/^zambo$/i);
            if (o?.success) {
              await bot.buyFromShop(/^karamjan? rum$/i, 1);
              await bot.closeShop();
            }
            await sleep(600);
          }
          if (!has(sdk, /^karamjan? rum$/i)) return false;
        }

        await fillBananaCrateForLuthas(true);

        // Sail back to Port Sarim
        await bot.walkTo(2954, 3146, 2);
        await talk(c, /^customs officer$/i, [/can i journey on this ship/i, /search away/i, /^ok\.?$/i]);
        await waitCond(() => (sdk.getState()?.player?.worldX ?? 2954) > 3000, 12_000, 400);
        await sleep(800);
        await chat(c);
        for (let i = 0; i < 3 && lvl(sdk) === 1; i++) {
          const plank = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2084 || /^gangplank$/i.test(l.name));
          if (plank) await bot.interactLoc(plank, /^cross$/i);
          if (await waitCond(() => lvl(sdk) === 0, 5000, 300)) break;
        }
      }

      return (sdk.getState()?.player?.worldX ?? 0) > 3000 && lvl(sdk) === 0;
    });

    const retrieveRumAndKey = () => step(c, N, 'retrieve-rum-and-key', async () => {
      if (has(sdk, /^chest key|pirate message|emerald$/i) || messageRead) return true;
      if (!has(sdk, /^karamjan? rum$/i)) {
        if (has(sdk, /^white apron$/i)) await bot.equipItem(/^white apron$/i);
        const ww = await bot.walkTo(3014, 3204, 2);
        if (!ww?.success) { await openNearbyDoors(c, 3016, 3206, 2); await bot.walkTo(3014, 3204, 2); }
        await talk(c, /^wydin$/i, [/can i get a job here/i, /no, thank you/i]);

        for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 3014) >= 3012; i++) {
          await sdk.sendWalk(3012, 3204, true);
          await sleep(1000);
          const wd = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2069);
          if (wd) await bot.interactLoc(wd, /^open$/i);
          if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 3014) <= 3011, 4000, 250)) break;
        }
        if ((sdk.getState()?.player?.worldX ?? 3014) >= 3012) return false;

        for (let i = 0; i < 3 && !has(sdk, /^karamjan? rum$/i); i++) {
          await sdk.sendWalk(3010, 3207, true);
          await sleep(800);
          const gc = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2071);
          if (gc) await bot.interactLoc(gc, /^search$/i);
          await waitCond(() => has(sdk, /^karamjan? rum$/i) || !!sdk.getState()?.dialog?.isOpen, 5000, 300);
          if (sdk.getState()?.dialog?.isOpen) await chat(c, [/^no$/i]);
        }

        for (let i = 0; i < 3 && (sdk.getState()?.player?.worldX ?? 3010) <= 3011; i++) {
          await sdk.sendWalk(3011, 3204, true);
          await sleep(800);
          const wd = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2069);
          if (wd) await bot.interactLoc(wd, /^open$/i);
          if (await waitCond(() => (sdk.getState()?.player?.worldX ?? 3010) >= 3012, 4000, 250)) break;
        }
        if (!has(sdk, /^karamjan? rum$/i)) return false;
      }

      await bot.walkTo(3053, 3250, 2);
      await talk(c, /^redbeard frank$/i, [/ok thanks, i'll go and get it/i]);
      return await waitInv(sdk, /^chest key$/i, 4000);
    });

    const blueMoonChest = () => step(c, N, 'blue-moon-chest', async () => {
      if (messageRead || has(sdk, /^emerald$/i)) return true;
      if (!has(sdk, /^pirate message$/i)) {
        if (lvl(sdk) === 0) {
          if (!(await walkToVarrock(c, 3226, 3394))) return false;
          const ws = await bot.walkTo(3226, 3394, 2);
          if (!ws?.success) { await openNearbyDoors(c, 3226, 3394, 3); await bot.walkTo(3226, 3394, 2); }
          for (let i = 0; i < 3 && lvl(sdk) === 0; i++) {
            const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1725);
            if (st) await bot.interactLoc(st, /climb-?up/i);
            else await bot.interactLoc(/^staircase$/i, /climb-?up/i);
            if (await waitCond(() => lvl(sdk) === 1, 5000, 300)) break;
          }
        }
        if (lvl(sdk) !== 1) return false;
        if (!has(sdk, /^spade$/i)) {
          await pickupWithWait(c, 3218, 3412, /^spade$/i, 10);
        }
        const wc = await bot.walkTo(3219, 3396, 2);
        if (!wc?.success) { await openNearbyDoors(c, 3220, 3396, 3); await bot.walkTo(3219, 3396, 2); }
        for (let i = 0; i < 3 && !has(sdk, /^pirate message$/i); i++) {
          const ch = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2079);
          if (ch) await bot.useItemOnLoc(/^chest key$/i, ch);
          else await bot.useItemOnLoc(/^chest key$/i, /^chest$/i);
          if (await waitInv(sdk, /^pirate message$/i, 8000)) break;
        }
        for (let i = 0; i < 3 && lvl(sdk) === 1; i++) {
          await bot.walkTo(3228, 3394, 2);
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1726);
          if (st) await bot.interactLoc(st, /climb-?down/i);
          else await bot.interactLoc(/^staircase$/i, /climb-?down/i);
          if (await waitCond(() => lvl(sdk) === 0, 5000, 300)) break;
        }
      }
      const pm = sdk.findInventoryItem(/^pirate message$/i);
      if (!pm) return false;
      await sdk.sendUseItem(pm.slot);
      await sleep(1500);
      await bot.closeInterface();
      messageRead = true;
      return true;
    });

    const digFaladorPark = () => step(c, N, 'dig-falador-park', async () => {
      if (has(sdk, /^emerald$/i)) return true;
      if ((sdk.getState()?.player?.worldX ?? 0) > 3120) {
        if (!(await walkFromVarrockToLumbridge(c, 3050, 3275))) return false;
        await bot.walkTo(3007, 3330, 3);
        await bot.walkTo(2965, 3385, 3);
      }
      if (!has(sdk, /^spade$/i)) {
        const ws = await bot.walkTo(2981, 3369, 2);
        if (!ws?.success) { await openNearbyDoors(c, 2981, 3369, 3); await bot.walkTo(2981, 3369, 2); }
        if (!(await pickupWithWait(c, 2981, 3369, /^spade$/i, 15))) return false;
      }

      await bot.walkTo(2999, 3383, 1);
      await sdk.sendSetCombatStyle(1);
      for (let round = 0; round < 5 && !has(sdk, /^emerald$/i); round++) {
        await bot.walkTo(2999, 3383, 0);
        const sp = sdk.findInventoryItem(/^spade$/i);
        if (!sp) return false;
        await sdk.sendUseItem(sp.slot);
        if (await waitInv(sdk, /^emerald$/i, 4500)) break;

        // If Gardener attacked us, kill the Gardener and immediately dig again
        const gard = sdk.findNearbyNpc(/^gardener$/i);
        if (gard) {
          const deadline = Date.now() + 45_000;
          while (Date.now() < deadline && sdk.findNearbyNpc(/^gardener$/i)) {
            await bot.dismissBlockingUI();
            const g = sdk.findNearbyNpc(/^gardener$/i);
            if (g && !sdk.getState()?.player?.combat?.inCombat) await bot.attack(g);
            await sleep(700);
          }
        }
      }

      const done = await waitInv(sdk, /^emerald$/i, 3000);
      await bot.closeInterface();
      return done;
    });

    return (await startAndSmuggle()) && (await retrieveRumAndKey()) && (await blueMoonChest()) && (await digFaladorPark());
  },
};
