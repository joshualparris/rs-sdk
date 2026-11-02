import { Ctx, Quest, has, count, lvl, sleep, talk, chat, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, pickupWithWait, combineItems, bankJunk, withdrawFromDraynorBank, walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround } from '../quest-kit';
import { cooks } from './cooks-assistant';
import { doric } from './dorics-quest';

const N = "The Knight's Sword";

const KEEP_RE = /^(coins|bronze pickaxe|bronze sword|wooden shield|hammer|bucket|bucket of water|pot|pot of flour|pastry dough|pie dish|pie shell|redberries|uncooked redberry pie|redberry pie|burnt pie|copper ore|tin ore|bronze bar|iron ore|iron bar|blurite ore|portrait|blurite sword)$/i;

export const squire: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if ((sdk.getSkill('Smithing')?.experience ?? 0) >= 300_000) return true;

    let squireStarted = false;
    let reldoSpoken = false;
    let thurgoPieGiven = false;
    let squirePortraitAsked = false;
    let thurgoPortraitGiven = false;

    const walkInRoom = async (x: number, z: number, tol = 1, timeout = 5000) => {
      const p0 = sdk.getState()?.player;
      if (p0 && Math.hypot(p0.worldX - x, p0.worldZ - z) <= tol) return true;
      await sdk.sendWalk(x, z, true);
      return await waitCond(() => {
        const p = sdk.getState()?.player;
        return !!p && Math.hypot(p.worldX - x, p.worldZ - z) <= tol;
      }, timeout, 250);
    };

    const mineRocks = async (x: number, z: number, rockIds: number[], itemRe: RegExp, targetCount: number) => {
      if (count(sdk, itemRe) >= targetCount) return true;
      await bot.walkTo(x, z, 2);
      for (let i = 0; i < targetCount * 6 && count(sdk, itemRe) < targetCount; i++) {
        const rock = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => rockIds.includes(l.id) && (l.options ?? []).some((o: string) => /^mine$/i.test(o)));
        if (!rock) { await sleep(1200); continue; }
        const before = count(sdk, itemRe);
        await bot.interactLoc(rock, 'Mine');
        await waitCond(() => count(sdk, itemRe) > before, 7000, 300);
      }
      return count(sdk, itemRe) >= targetCount;
    };

    const startAndReldo = () => step(c, N, 'start-squire-and-reldo', async () => {
      if (reldoSpoken || thurgoPieGiven || squirePortraitAsked || thurgoPortraitGiven || has(sdk, /^portrait|blurite sword$/i)) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);

      // Ensure Level 10 Cooking & Level 10 Mining via Cook's Assistant & Doric's Quest if on a fresh bot
      if ((sdk.getSkill('Cooking')?.baseLevel ?? 1) < 10) {
        if (!(await cooks.run(c))) return false;
      }
      if ((sdk.getSkill('Mining')?.baseLevel ?? 1) < 10) {
        if (!(await doric.run(c))) return false;
      }

      await bankJunk(c, KEEP_RE);
      await withdrawFromDraynorBank(c, [/^coins$/i, /^bronze pickaxe$/i, /^bronze sword$/i, /^wooden shield$/i, /^hammer$/i, /^bucket$/i, /^pot$/i, /^iron bar$/i]);
      if (has(sdk, /^bronze sword$/i)) await bot.equipItem(/^bronze sword$/i);
      if (has(sdk, /^wooden shield$/i)) await bot.equipItem(/^wooden shield$/i);

      if (!squireStarted) {
        await bot.walkTo(3007, 3330, 3);
        await bot.walkTo(2965, 3365, 3);
        await bot.walkTo(2977, 3342, 2);
        if (!(await talk(c, /^squire$/i, [
          /how is life as a squire/i,
          /make a new sword if you like/i,
          /would these dwarves make another one/i,
          /give it a go/i,
        ]))) return false;
        squireStarted = true;
      }

      await bot.walkTo(2965, 3365, 3);
      await bot.walkTo(3007, 3330, 3);
      await bot.walkTo(3110, 3260, 3);
      if (!(await walkToVarrock(c, 3212, 3472))) return false;
      const wl = await bot.walkTo(3211, 3494, 2);
      if (!wl?.success) {
        await openNearbyDoors(c, 3212, 3471, 3);
        await openNearbyDoors(c, 3209, 3490, 3);
        await bot.walkTo(3211, 3494, 2);
      }
      if (!(await talk(c, /^reldo$/i, [/what do you know about the imcando dwarves/i]))) return false;
      reldoSpoken = true;
      return true;
    });

    const pieAndBars = () => step(c, N, 'redberry-pie-and-iron-bars', async () => {
      if (thurgoPieGiven || squirePortraitAsked || thurgoPortraitGiven || has(sdk, /^portrait|blurite sword$/i)) return true;

      // 1. In Varrock Palace Kitchen (3222, 3494), grab Pie dish and fill Bucket at Sink (3224, 3494)
      if (!has(sdk, /^redberry pie|uncooked redberry pie|pie shell$/i) && !has(sdk, /^pie dish$/i)) {
        const wk = await bot.walkTo(3222, 3494, 2);
        if (!wk?.success) {
          await openNearbyDoors(c, 3209, 3490, 3);
          await openNearbyDoors(c, 3217, 3492, 3);
          await openNearbyDoors(c, 3223, 3491, 3);
          await bot.walkTo(3222, 3494, 2);
        }
        if (!(await pickupWithWait(c, 3222, 3494, /^pie dish$/i, 15))) return false;
      }

      if (!has(sdk, /^redberry pie|uncooked redberry pie|pie shell|pastry dough$/i) && !has(sdk, /^bucket of water$/i)) {
        if (!has(sdk, /^bucket$/i)) {
          await walkFromVarrockToLumbridge(c, 3216, 3291);
          await pickupWithWait(c, 3216, 3291, /^bucket$/i, 15);
        }
        if ((sdk.getState()?.player?.worldZ ?? 0) > 3450) {
          await bot.walkTo(3224, 3494, 1);
          await bot.useItemOnLoc(/^bucket$/i, /^sink$/i);
          await waitInv(sdk, /^bucket of water$/i, 5000);
        } else {
          await bot.walkTo(3237, 3434, 2);
          await bot.useItemOnLoc(/^bucket$/i, /^fountain$/i);
          await waitInv(sdk, /^bucket of water$/i, 5000);
        }
      }

      // 2. Pick 2 Redberries at SE Varrock (3267, 3371) in case the first pie burns
      if (!has(sdk, /^redberry pie|uncooked redberry pie$/i) && count(sdk, /^redberries$/i) < 2) {
        if (!(await walkToVarrock(c, 3267, 3371))) return false;
        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline && count(sdk, /^redberries$/i) < 2) {
          const g = sdk.findGroundItem(/^redberries$/i);
          if (g) {
            const b = count(sdk, /^redberries$/i);
            await bot.pickupItem(g);
            await waitCond(() => count(sdk, /^redberries$/i) > b, 4000, 300);
          } else {
            await sleep(1500);
          }
        }
      }

      // 3. Ensure 2 Iron bars (if Smithing < 15, mine 5 Copper + 5 Tin; then mine 5 Iron ore at SE Varrock 3285,3368)
      if (count(sdk, /^iron bar$/i) < 2) {
        const needBronze = (sdk.getSkill('Smithing')?.baseLevel ?? 1) < 15 ? 5 : 0;
        if (needBronze > 0 && count(sdk, /^bronze bar$/i) < needBronze) {
          if (!(await walkToVarrock(c, 3286, 3364))) return false;
          if (!(await mineRocks(3286, 3364, [2090, 2091], /^copper ore$/i, needBronze))) return false;
          if (!(await mineRocks(3283, 3365, [2094, 2095], /^tin ore$/i, needBronze))) return false;
        }
        if (count(sdk, /^iron ore$/i) < 5) {
          if (!(await walkToVarrock(c, 3285, 3368))) return false;
          if (!(await mineRocks(3285, 3368, [2092, 2093], /^iron ore$/i, 5))) return false;
        }
      }

      if ((sdk.getState()?.player?.worldZ ?? 0) > 3350) {
        if (!(await walkFromVarrockToLumbridge(c, 3212, 3246))) return false;
      }

      // Buy Hammer at Lumbridge General Store (3212, 3246) if needed for training Smithing to 15
      if (count(sdk, /^iron bar$/i) < 2 && (sdk.getSkill('Smithing')?.baseLevel ?? 1) < 15 && !has(sdk, /^hammer$/i)) {
        const wg = await bot.walkTo(3212, 3246, 2);
        if (!wg?.success) { await openNearbyDoors(c, 3212, 3246, 3); await bot.walkTo(3212, 3246, 2); }
        const o = await bot.openShop(/^shop keeper$/i);
        if (o?.success) {
          await bot.buyFromShop(/^hammer$/i, 1);
          await bot.closeShop();
        }
      }

      // 4. Buy 2 Pot of flour from Wydin in Port Sarim (3014, 3204) and make/cook Redberry pie
      if (!has(sdk, /^redberry pie$/i)) {
        if (!has(sdk, /^uncooked redberry pie$/i) && count(sdk, /^pot of flour$/i) < 2) {
          const ww = await bot.walkTo(3014, 3204, 2);
          if (!ww?.success) { await openNearbyDoors(c, 3017, 3206, 2); await bot.walkTo(3014, 3204, 2); }
          const o = await bot.openShop(/^wydin$/i);
          if (o?.success) {
            await bot.buyFromShop(/^pot of flour$/i, 2);
            if (!has(sdk, /^redberries$/i)) await bot.buyFromShop(/^redberries$/i, 1);
            await bot.closeShop();
          }
        }

        for (let attempt = 0; attempt < 2 && !has(sdk, /^redberry pie$/i); attempt++) {
          if (has(sdk, /^burnt pie$/i)) {
            const bp = sdk.findInventoryItem(/^burnt pie$/i);
            if (bp) { await sdk.sendUseItem(bp.slot); await sleep(800); }
          }
          if (!has(sdk, /^uncooked redberry pie$/i)) {
            if (!has(sdk, /^pie shell$/i)) {
              if (!has(sdk, /^pastry dough$/i)) {
                if (!has(sdk, /^bucket of water$/i)) {
                  await bot.walkTo(3121, 3243, 2); // sink/water or Lumbridge sink (3207, 3213)
                  const ws = await bot.walkTo(3014, 3233, 2);
                  // Port Sarim / Rimmington well or Falador waterpump (2968, 3364)
                  await bot.walkTo(3207, 3213, 2);
                  await bot.useItemOnLoc(/^bucket$/i, /^sink$/i);
                  await waitInv(sdk, /^bucket of water$/i, 5000);
                }
                const fl = sdk.findInventoryItem(/^pot of flour$/i);
                const bw = sdk.findInventoryItem(/^bucket of water$/i);
                if (fl && bw) {
                  await sdk.sendUseItemOnItem(fl.slot, bw.slot);
                  if (await waitCond(() => !!sdk.getState()?.dialog?.isOpen, 4000, 250)) {
                    await chat(c, [/pastry dough/i]);
                  }
                  await waitInv(sdk, /^pastry dough$/i, 4000);
                }
              }
              await combineItems(c, /^pastry dough$/i, /^pie dish$/i, /^pie shell$/i);
            }
            await combineItems(c, /^pie shell$/i, /^redberries$/i, /^uncooked redberry pie$/i);
          }

          // Cook on Port Sarim range at (3016, 3238)
          const wr = await bot.walkTo(3016, 3238, 2);
          if (!wr?.success) { await openNearbyDoors(c, 3016, 3238, 3); await bot.walkTo(3016, 3238, 2); }
          await bot.useItemOnLoc(/^uncooked redberry pie$/i, /^range$/i);
          await waitCond(() => !has(sdk, /^uncooked redberry pie$/i), 6000, 300);
        }
        if (!has(sdk, /^redberry pie$/i)) return false;
      }

      // 5. Smelt Bronze/Iron bars at Falador Furnace (2974, 3369)
      if (count(sdk, /^iron bar$/i) < 2) {
        await bot.walkTo(3007, 3330, 3);
        const wf = await bot.walkTo(2974, 3369, 2);
        if (!wf?.success) { await openNearbyDoors(c, 2977, 3373, 2); await bot.walkTo(2974, 3369, 2); }
        while (has(sdk, /^copper ore$/i) && has(sdk, /^tin ore$/i)) {
          const b = count(sdk, /^bronze bar$/i);
          await bot.useItemOnLoc(/^copper ore$/i, /^furnace$/i);
          await waitCond(() => count(sdk, /^bronze bar$/i) > b, 5000, 300);
        }
        if ((sdk.getSkill('Smithing')?.baseLevel ?? 1) < 15 && has(sdk, /^bronze bar$/i)) {
          await bot.walkTo(2997, 3145, 2);
          while ((sdk.getSkill('Smithing')?.baseLevel ?? 1) < 15 && has(sdk, /^bronze bar$/i)) {
            await bot.smithAtAnvil('dagger');
            await sleep(600);
          }
          await bot.walkTo(2974, 3369, 2);
        }
        for (let i = 0; i < 8 && count(sdk, /^iron bar$/i) < 2 && has(sdk, /^iron ore$/i); i++) {
          const b = count(sdk, /^iron ore$/i);
          await bot.useItemOnLoc(/^iron ore$/i, /^furnace$/i);
          await waitCond(() => count(sdk, /^iron ore$/i) < b, 5000, 300);
        }
        if (count(sdk, /^iron bar$/i) < 2) return false;
      }

      // 6. Talk to Thurgo at (3001, 3144) to give Redberry pie and ask about sword
      await bot.walkTo(3001, 3144, 2);
      if (has(sdk, /^redberry pie$/i)) {
        await talk(c, /^thurgo$/i, [/would you like (a|some) redberry pie/i]);
        if (!(await waitCond(() => !has(sdk, /^redberry pie$/i), 4000, 300))) return false;
      }
      if (!(await talk(c, /^thurgo$/i, [/make me a special sword/i]))) return false;
      thurgoPieGiven = true;
      return true;
    });

    const portrait = () => step(c, N, 'steal-portrait', async () => {
      if (thurgoPortraitGiven || has(sdk, /^portrait|blurite sword$/i)) return true;

      if (!squirePortraitAsked) {
        if (lvl(sdk) > 0) {
          // Climb down from East Wing if needed
          if (lvl(sdk) === 2) {
            await walkInRoom(2984, 3338, 1, 4000);
            const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1723);
            if (st) await bot.interactLoc(st, /(walk|climb)-?down/i);
            await waitCond(() => lvl(sdk) === 1, 5000, 300);
          }
          if (lvl(sdk) === 1) {
            await bot.walkTo(2983, 3350, 2);
            const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1746);
            if (lad) await bot.interactLoc(lad, /climb-?down/i);
            await waitCond(() => lvl(sdk) === 0, 5000, 300);
          }
        }
        await bot.walkTo(3007, 3330, 3);
        await bot.walkTo(2965, 3365, 3);
        await bot.walkTo(2977, 3342, 2);
        if (!(await talk(c, /^squire$/i))) return false;
        squirePortraitAsked = true;
      }

      // Climb to East Wing L2 of Falador Castle:
      // L0 (2983, 3351) ladder 1747 -> L1 -> L1 (2984, 3337) stairs 1722 -> L2 (2984, 3338)
      if (lvl(sdk) === 0) {
        const wl = await bot.walkTo(2984, 3350, 2);
        if (!wl?.success) {
          await openNearbyDoors(c, 2983, 3348, 3);
          await openNearbyDoors(c, 2986, 3348, 3);
          await bot.walkTo(2984, 3350, 2);
        }
        for (let i = 0; i < 3 && lvl(sdk) === 0; i++) {
          const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1747 && Math.hypot(l.x - 2983, l.z - 3351) <= 2);
          if (lad) await bot.interactLoc(lad, /climb-?up/i);
          else await bot.interactLoc(/^ladder$/i, /climb-?up/i);
          if (await waitCond(() => lvl(sdk) === 1, 5000, 300)) break;
        }
      }
      if (lvl(sdk) === 1) {
        const ws = await bot.walkTo(2984, 3340, 2);
        if (!ws?.success) {
          await openNearbyDoors(c, 2984, 3345, 3);
          await bot.walkTo(2984, 3340, 2);
        }
        for (let i = 0; i < 3 && lvl(sdk) === 1; i++) {
          const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1722);
          if (st) await bot.interactLoc(st, /(walk|climb)-?up/i);
          else await bot.interactLoc(/^staircase$/i, /(walk|climb)-?up/i);
          if (await waitCond(() => lvl(sdk) === 2, 5000, 300)) break;
        }
      }
      if (lvl(sdk) !== 2) return false;

      // Open door at L2 (2981, 3337) if closed so Sir Vyvin can wander or we can stand next to cupboard (2984, 3336)
      const wc = await bot.walkTo(2983, 3336, 1);
      if (!wc?.success) {
        await openNearbyDoors(c, 2981, 3337, 2);
        await bot.walkTo(2983, 3336, 1);
      }

      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline && !has(sdk, /^portrait$/i)) {
        await walkInRoom(2983, 3336, 0, 4000);
        const closedCup = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2271);
        if (closedCup) {
          await bot.interactLoc(closedCup, /^open$/i);
          await sleep(800);
        }
        const vyvin = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^sir vyvin$/i.test(n.name));
        if (vyvin && Math.max(Math.abs(vyvin.x - 2983), Math.abs(vyvin.z - 3336)) <= 1) {
          await sleep(800);
          continue;
        }
        const openCup = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2272);
        if (openCup) {
          await bot.interactLoc(openCup, /^search$/i);
          if (await waitCond(() => has(sdk, /^portrait$/i) || !!sdk.getState()?.dialog?.isOpen, 4000, 250)) {
            await chat(c);
          }
        }
        await sleep(500);
      }

      // Climb back down to L0
      if (lvl(sdk) === 2) {
        await walkInRoom(2984, 3338, 1, 4000);
        const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1723);
        if (st) await bot.interactLoc(st, /(walk|climb)-?down/i);
        await waitCond(() => lvl(sdk) === 1, 5000, 300);
      }
      if (lvl(sdk) === 1) {
        const wl = await bot.walkTo(2984, 3350, 2);
        if (!wl?.success) { await openNearbyDoors(c, 2984, 3345, 3); await bot.walkTo(2984, 3350, 2); }
        const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1746);
        if (lad) await bot.interactLoc(lad, /climb-?down/i);
        await waitCond(() => lvl(sdk) === 0, 5000, 300);
      }

      return has(sdk, /^portrait$/i);
    });

    const bluriteAndFinish = () => step(c, N, 'blurite-sword-and-finish', async () => {
      if ((sdk.getSkill('Smithing')?.experience ?? 0) >= 300_000) return true;

      if (!has(sdk, /^blurite sword$/i)) {
        if ((sdk.getState()?.player?.worldZ ?? 0) < 9000) {
          if (has(sdk, /^portrait$/i)) {
            await bot.walkTo(3007, 3330, 3);
            await bot.walkTo(3001, 3144, 2);
            await talk(c, /^thurgo$/i, [/picture of the sword/i]);
            if (!(await waitCond(() => !has(sdk, /^portrait$/i), 4000, 300))) return false;
            thurgoPortraitGiven = true;
          }
          if (!has(sdk, /^blurite ore$/i)) {
            await bot.walkTo(3008, 3150, 1);
            for (let i = 0; i < 3 && (sdk.getState()?.player?.worldZ ?? 0) < 9000; i++) {
              const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1759);
              if (lad) await bot.interactLoc(lad, /climb-?down/i);
              else await bot.interactLoc(/^ladder$/i, /climb-?down/i);
              if (await waitCond(() => (sdk.getState()?.player?.worldZ ?? 0) > 9000, 5000, 300)) break;
            }
          }
        }

        if ((sdk.getState()?.player?.worldZ ?? 0) > 9000) {
          if (!has(sdk, /^blurite ore$/i)) {
            await bot.walkTo(3028, 9555, 3);
            await bot.walkTo(3049, 9566, 2);
            if (!(await mineRocks(3049, 9566, [2110], /^blurite ore$/i, 1))) return false;
          }
          await bot.walkTo(3028, 9555, 3);
          await bot.walkTo(3008, 9550, 1);
          for (let i = 0; i < 3 && (sdk.getState()?.player?.worldZ ?? 0) > 9000; i++) {
            const lad = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 1755);
            if (lad) await bot.interactLoc(lad, /climb-?up/i);
            else await bot.interactLoc(/^ladder$/i, /climb-?up/i);
            if (await waitCond(() => (sdk.getState()?.player?.worldZ ?? 0) < 9000, 5000, 300)) break;
          }
        }

        await bot.walkTo(3001, 3144, 2);
        await talk(c, /^thurgo$/i);
        if (!(await waitInv(sdk, /^blurite sword$/i, 5000))) return false;
      }

      await bot.walkTo(3007, 3330, 3);
      await bot.walkTo(2965, 3365, 3);
      await bot.walkTo(2977, 3342, 2);
      const beforeXp = sdk.getSkill('Smithing')?.experience ?? 0;
      await talk(c, /^squire$/i);
      const done = await waitCond(() => (sdk.getSkill('Smithing')?.experience ?? 0) > beforeXp, 6000, 300);
      await bot.closeInterface();
      return done;
    });

    return (await startAndReldo()) && (await pieAndBars()) && (await portrait()) && (await bluriteAndFinish());
  },
};
