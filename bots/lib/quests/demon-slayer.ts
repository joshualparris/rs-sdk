import {
  Ctx, Quest, has, count, log, sleep, talk, chat, waitInv, waitCond, step, lvl,
  bankJunk, withdrawFromDraynorBank, openNearbyDoors, pickupWithWait,
  walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround
} from '../quest-kit';

const N = 'Demon Slayer';
const KEEP_RE = /^(coins|bucket|bucket of water|bones|key|silverlight|bronze sword|iron dagger|steel|mithril|adamant|rune|shrimps|anchovies|bread|cooked meat|cooked chicken|pie|cake|trout|salmon|lobster)$/i;

export const demon: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    await exitWizardsTowerGround(c);

    let questComplete = false;
    let keyHuntStarted = false;
    let traibornStarted = false;

    const hasKey1 = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 2399);
    const hasKey2 = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 2400);
    const hasKey3 = () => (sdk.getInventory() ?? []).some((i: any) => i.id === 2401);
    const hasSilverlight = () =>
      (sdk.getInventory() ?? []).some((i: any) => i.id === 2402 || /^silverlight$/i.test(i.name)) ||
      (sdk.getEquipment() ?? []).some((i: any) => i.id === 2402 || /^silverlight$/i.test(i.name));

    const climbWizardsTower = async (targetLevel: number) => {
      for (let g = 0; g < 6 && lvl(sdk) !== targetLevel; g++) {
        const cur = lvl(sdk);
        const dir = targetLevel > cur ? /climb-?up/i : /climb-?down/i;
        if (cur === 0) {
          const w = await bot.walkTo(3105, 3160, 2);
          if (!w?.success) {
            await openNearbyDoors(c, 3109, 3166, 2);
            await openNearbyDoors(c, 3107, 3162, 2);
            await bot.walkTo(3105, 3160, 2);
          }
        }
        const st = (sdk.getState()?.nearbyLocs ?? [])
          .filter((l: any) => /stair/i.test(l.name) && Math.hypot(l.x - 3104, l.z - 3160) <= 4 && (l.options ?? []).some((o: string) => dir.test(o)))
          .sort((a: any, b: any) => a.distance - b.distance)[0];
        if (st) {
          await bot.interactLoc(st, dir);
          await waitCond(() => lvl(sdk) !== cur, 5000, 250);
        }
        await sleep(600);
      }
      return lvl(sdk) === targetLevel;
    };

    const climbPalaceNW = async (targetLevel: number) => {
      for (let g = 0; g < 6 && lvl(sdk) !== targetLevel; g++) {
        const cur = lvl(sdk);
        const dir = targetLevel > cur ? /climb-?up/i : /climb-?down/i;
        const st = (sdk.getState()?.nearbyLocs ?? [])
          .filter((l: any) => [1738, 1739, 1740].includes(l.id) && Math.hypot(l.x - 3202, l.z - 3497) <= 5 && (l.options ?? []).some((o: string) => dir.test(o)))
          .sort((a: any, b: any) => a.distance - b.distance)[0];
        if (!st) {
          if (cur === 0) {
            const w = await bot.walkTo(3203, 3496, 2);
            if (!w?.success) {
              await openNearbyDoors(c, 3203, 3488, 3);
              await openNearbyDoors(c, 3206, 3494, 3);
              await bot.walkTo(3203, 3496, 2);
            }
          }
          await sleep(600);
          continue;
        }
        await bot.interactLoc(st, dir);
        await waitCond(() => lvl(sdk) !== cur, 5000, 250);
        await sleep(600);
      }
      return lvl(sdk) === targetLevel;
    };

    const start = () => step(c, N, 'start-aris-and-prysin', async () => {
      if (questComplete || keyHuntStarted || hasKey1() || hasKey2() || hasKey3() || hasSilverlight()) return true;

      if ((sdk.getState()?.player?.worldZ ?? 0) < 3350) {
        await bankJunk(c, KEEP_RE);
        await withdrawFromDraynorBank(c, [/^coins$/i, /^bucket$/i, /^bucket of water$/i, /^bones$/i]);
        while (count(sdk, /^coins$/i) < 1) {
          await bot.walkTo(3100, 3250, 4);
          const npc = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^(man|woman)$/i.test(n.name) && n.combatLevel <= 4);
          if (npc) await bot.pickpocketNpc(npc);
          await sleep(800);
        }
        if (!has(sdk, /^bucket|bucket of water$/i)) {
          await bot.walkTo(3216, 3291, 2);
          await pickupWithWait(c, 3216, 3291, /^bucket$/i, 15);
        }
      }

      if (!(await walkToVarrock(c, 3203, 3424))) return false;
      while (count(sdk, /^coins$/i) < 1) {
        await bot.walkTo(3210, 3424, 4);
        const npc = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^(man|woman)$/i.test(n.name) && n.combatLevel <= 4);
        if (npc) await bot.pickpocketNpc(npc);
        await sleep(800);
      }
      await bot.walkTo(3203, 3424, 2);
      if (!(await talk(c, /^gypsy$/i, [
        /ok, here you go/i,
        /what does that aaargh bit mean|are you alright/i,
        /who's delrith/i,
        /how am i meant to fight|where is he\? i'll kill him/i,
        /what is the magical incantation/i,
        /where can i find silverlight/i,
        /okay, thanks\. i'll do my best|well i'd better press on/i,
      ], 26))) return false;

      const recentAris = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/you're a hero now|good bit of demonslaying/i.test(recentAris)) {
        questComplete = true;
        return true;
      }
      if (/found sir prysin/i.test(recentAris)) {
        keyHuntStarted = true;
        return true;
      }

      const wp = await bot.walkTo(3204, 3472, 2);
      if (!wp?.success) {
        await openNearbyDoors(c, 3207, 3473, 3);
        await bot.walkTo(3204, 3472, 2);
      }
      if (!(await talk(c, /^sir prysin$/i, [
        /gypsy aris said i should come/i,
        /i need to find silverlight/i,
        /crystal ball seems to think|he's back and unfortunately/i,
        /so give me the keys/i,
        /can you give me your key/i,
        /so what does the drain lead to/i,
        /where can i find captain rovin/i,
        /where does the wizard live/i,
        /well i'd better go key hunting|i'm still looking/i,
      ], 26))) return false;

      const recentPrysin = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/heard you stopped the demon/i.test(recentPrysin)) {
        questComplete = true;
        return true;
      }
      if (/sorted out that demon yet/i.test(recentPrysin)) {
        if (!hasSilverlight()) {
          await talk(c, /^sir prysin$/i, [/afraid i've lost silverlight/i]);
          await waitCond(() => hasSilverlight(), 4000);
        }
        return hasSilverlight();
      }
      keyHuntStarted = true;
      return true;
    });

    const rovinAndDrain = () => step(c, N, 'rovin-and-drain-keys', async () => {
      if (questComplete || hasSilverlight() || (hasKey2() && hasKey3())) return true;
      const inSewer = () => (sdk.getState()?.player?.worldZ ?? 0) > 9800;

      if (!inSewer() && (sdk.getState()?.player?.worldZ ?? 0) < 3380) {
        if (!(await walkToVarrock(c, 3212, 3465))) return false;
      }

      if (!hasKey2() && !inSewer()) {
        if (!(await climbPalaceNW(2))) return false;
        await talk(c, /^captain rovin$/i, [
          /yes,? i know, but this is important/i,
          /there's a demon who wants to invade/i,
        ]);
        if (!(await waitCond(() => hasKey2(), 5000, 250))) return false;
        await climbPalaceNW(0);
      }

      if (!hasKey3()) {
        if (lvl(sdk) > 0) await climbPalaceNW(0);
        if (!inSewer()) {
          if (!has(sdk, /^bucket of water$/i)) {
            if (!has(sdk, /^bucket$/i)) {
              // Climb up palace NE stairs at (3212, 3473) to pick up Bucket at L1 (3221, 3497)
              await bot.walkTo(3212, 3472, 2);
              const stUp = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1722);
              if (stUp) {
                await bot.interactLoc(stUp, /climb-?up/i);
                await waitCond(() => lvl(sdk) === 1, 5000);
              }
              if (lvl(sdk) === 1) {
                const wb = await bot.walkTo(3221, 3496, 2);
                if (!wb?.success) { await openNearbyDoors(c, 3219, 3492, 3); await bot.walkTo(3221, 3496, 2); }
                await pickupWithWait(c, 3221, 3497, /^bucket$/i, 15);
                await bot.walkTo(3212, 3475, 2);
                const stDn = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1723);
                if (stDn) {
                  await bot.interactLoc(stDn, /climb-?down/i);
                  await waitCond(() => lvl(sdk) === 0, 5000);
                }
              }
            }
            if (!has(sdk, /^bucket$/i)) return false;
            await bot.walkTo(3218, 3465, 2);
            await bot.useItemOnLoc(/^bucket$/i, /^fountain$/i);
            if (!(await waitInv(sdk, /^bucket of water$/i, 5000))) return false;
          }

          await bot.walkTo(3225, 3496, 1);
          await bot.useItemOnLoc(/^bucket of water$/i, /^drain$/i);
          if (!(await waitInv(sdk, /^bucket$/i, 5000))) return false;
          await sleep(2500);

          await bot.walkTo(3237, 3458, 1);
          for (let i = 0; i < 4 && !inSewer(); i++) {
            const mhClosed = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 881);
            if (mhClosed) {
              await bot.interactLoc(mhClosed, 'Open');
              await sleep(1200);
            }
            const mhOpen = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 882);
            if (mhOpen) {
              await bot.interactLoc(mhOpen, /climb-?down/i);
              if (await waitCond(() => inSewer(), 5000, 250)) break;
            }
            await sleep(600);
          }
          if (!inSewer()) return false;
        }

        await bot.walkTo(3237, 9866, 2);
        await bot.walkTo(3229, 9882, 2);
        await bot.walkTo(3225, 9897, 2);
        if (!(await pickupWithWait(c, 3225, 9897, /^key$/i, 15))) return false;

        await bot.walkTo(3229, 9882, 2);
        await bot.walkTo(3237, 9858, 2);
        for (let i = 0; i < 4 && inSewer(); i++) {
          const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1755);
          if (lad) await bot.interactLoc(lad, /climb-?up/i);
          else await bot.interactLoc(/^ladder$/i, /climb-?up/i);
          if (await waitCond(() => !inSewer(), 5000, 250)) break;
        }
      }

      return hasKey2() && hasKey3();
    });

    const traibornKey = () => step(c, N, 'traiborn-bones-key', async () => {
      if (questComplete || hasSilverlight() || hasKey1()) return true;

      if ((sdk.getState()?.player?.worldZ ?? 0) > 3350) {
        if (!(await walkFromVarrockToLumbridge(c, 3092, 3245))) return false;
      }

      // Free inventory space at Draynor bank so we can carry ~20+ bones per trip
      await bankJunk(c, /^(coins|bones|key|silverlight|bronze sword|iron dagger|steel|mithril|adamant|rune)$/i);
      await withdrawFromDraynorBank(c, [/^bones$/i]);

      if (!traibornStarted) {
        await bot.walkTo(3108, 3168, 2);
        if (!(await climbWizardsTower(1))) return false;
        const wt = await bot.walkTo(3112, 3162, 2);
        if (!wt?.success) {
          await openNearbyDoors(c, 3107, 3162, 3);
          await openNearbyDoors(c, 3111, 3162, 3);
          await bot.walkTo(3112, 3162, 2);
        }
        await talk(c, /^traiborn$/i, [
          /need to get a key given to you by sir prysin/i,
          /well, have you got any keys knocking around/i,
          /i'll get the bones for you/i,
        ], 20);
        // If we already had bones and Traiborn was already on bone-collection stage, wait for bone loop
        await waitCond(() => count(sdk, /^bones$/i) === 0 || !!sdk.getState()?.dialog?.isOpen, 20000, 400);
        if (sdk.getState()?.dialog?.isOpen) await chat(c);
        await sleep(1000);
        traibornStarted = true;
        await climbWizardsTower(0);
        await exitWizardsTowerGround(c);
        if (hasKey1()) return true;
      }

      for (let trip = 0; trip < 4 && !hasKey1(); trip++) {
        // Collect bones from Lumbridge west chicken farm (3177, 3296) or east chicken farm (3231, 3295)
        while ((sdk.getInventory()?.length ?? 0) < 28 && count(sdk, /^bones$/i) < 25) {
          const p = sdk.getState()?.player;
          if (!p || Math.hypot(p.worldX - 3177, p.worldZ - 3296) > 12) {
            const wc = await bot.walkTo(3177, 3296, 3);
            if (!wc?.success) {
              await openNearbyDoors(c, 3183, 3291, 3);
              await openNearbyDoors(c, 3177, 3291, 3);
              await bot.walkTo(3177, 3296, 3);
            }
          }
          const gBone = (sdk.getState()?.groundItems ?? [])
            .filter((g: any) => /^bones$/i.test(g.name) && g.reachable !== false && g.distance <= 8)
            .sort((a: any, b: any) => a.distance - b.distance)[0];
          if (gBone) {
            const before = count(sdk, /^bones$/i);
            await bot.pickupItem(gBone);
            await waitCond(() => count(sdk, /^bones$/i) > before, 3000, 250);
            continue;
          }
          const chk = (sdk.getState()?.nearbyNpcs ?? [])
            .filter((n: any) => /^chicken$/i.test(n.name) && !n.inCombat && n.reachable !== false)
            .sort((a: any, b: any) => a.distance - b.distance)[0];
          if (chk) {
            await bot.attack(chk);
            await waitCond(() => !sdk.getState()?.player?.combat?.inCombat && (sdk.getState()?.groundItems ?? []).some((g: any) => /^bones$/i.test(g.name) && g.distance <= 3), 8000, 300);
          } else {
            await sleep(800);
          }
        }

        await bot.walkTo(3108, 3168, 2);
        if (!(await climbWizardsTower(1))) return false;
        const wt = await bot.walkTo(3112, 3162, 2);
        if (!wt?.success) {
          await openNearbyDoors(c, 3107, 3162, 3);
          await openNearbyDoors(c, 3111, 3162, 3);
          await bot.walkTo(3112, 3162, 2);
        }
        await talk(c, /^traiborn$/i);
        // Wait for Traiborn's 1-bone-per-tick loop to finish and open the completion or "I still need more" dialog
        await waitCond(() => count(sdk, /^bones$/i) === 0 && !!sdk.getState()?.dialog?.isOpen, 22000, 400);
        if (sdk.getState()?.dialog?.isOpen) {
          await chat(c);
        }
        await waitCond(() => hasKey1(), 4000, 250);
        await climbWizardsTower(0);
        await exitWizardsTowerGround(c);
      }

      return hasKey1();
    });

    const slayDelrith = () => step(c, N, 'silverlight-and-delrith', async () => {
      if (questComplete) return true;
      if ((sdk.getState()?.player?.level ?? 0) > 0 && Math.hypot((sdk.getState()?.player?.worldX ?? 0) - 3106, (sdk.getState()?.player?.worldZ ?? 0) - 3162) < 15) {
        await climbWizardsTower(0);
      }
      await exitWizardsTowerGround(c);

      if (!hasSilverlight()) {
        if (!(await walkToVarrock(c, 3204, 3472))) return false;
        const wp = await bot.walkTo(3204, 3472, 2);
        if (!wp?.success) {
          await openNearbyDoors(c, 3207, 3473, 3);
          await bot.walkTo(3204, 3472, 2);
        }
        await talk(c, /^sir prysin$/i, [/afraid i've lost silverlight/i]);
        if (!(await waitCond(() => hasSilverlight(), 6000, 250))) return false;
      }

      if (has(sdk, /^silverlight$/i)) {
        await bot.equipItem(/^silverlight$/i);
        await sleep(600);
      }

      if (!(await walkToVarrock(c, 3228, 3369))) return false;
      await bot.walkTo(3228, 3369, 2);

      for (let i = 0; i < 40; i++) {
        const msgs = (sdk.getState()?.gameMessages ?? []).map((m: any) => m.text).join(' ');
        if (/completed the\s*demon slayer quest/i.test(msgs) || sdk.getState()?.interface?.isOpen) {
          await bot.closeInterface();
          questComplete = true;
          return true;
        }
        const dlg = sdk.getState()?.dialog;
        if (dlg?.isOpen) {
          await chat(c, [/carlem aber camerinthum purchai gabindo/i]);
          const done = await waitCond(() => {
            const m = (sdk.getState()?.gameMessages ?? []).map((x: any) => x.text).join(' ');
            return /completed the\s*demon slayer quest/i.test(m) || !!sdk.getState()?.interface?.isOpen;
          }, 6000, 300);
          if (done) {
            await bot.closeInterface();
            questComplete = true;
            return true;
          }
          continue;
        }
        if (sdk.findNearbyNpc(/^weakened delrith$/i)) {
          await sleep(600);
          continue;
        }
        const del = sdk.findNearbyNpc(/^delrith$/i);
        if (del) {
          await bot.attack(del);
          await waitCond(() => !!sdk.getState()?.dialog?.isOpen || !!sdk.findNearbyNpc(/^weakened delrith$/i) || !sdk.getState()?.player?.combat?.inCombat, 6000, 250);
        } else {
          await sleep(1000);
        }
      }
      return questComplete;
    });

    return (await start()) && (await rovinAndDrain()) && (await traibornKey()) && (await slayDelrith());
  },
};
