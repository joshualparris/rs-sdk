import { Ctx, Quest, has, count, xp, lvl, sleep, talk, waitInv, waitCond, step, lumbridgeStairs, openNearbyDoors, combineItems, bankJunk, withdrawFromDraynorBank, walkToVarrock, walkFromVarrockToLumbridge, exitWizardsTowerGround } from '../quest-kit';
const N = 'Goblin Diplomacy';

export const gobdip: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (has(sdk, /^gold bar$/i)) return true;
    let started = false;

    const totalMails = () =>
      count(sdk, /^goblin mail$/i) + count(sdk, /^orange goblin mail$/i) + count(sdk, /^blue goblin mail$/i);

    const startPortSarim = () => step(c, N, 'start-port-sarim', async () => {
      if (started || has(sdk, /^gold bar$/i)) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) > 0) await lumbridgeStairs(c, 0);
      await bankJunk(c, /^(coins|bronze sword|wooden shield|goblin mail|orange goblin mail|blue goblin mail|redberries|onion|woad leaf|red dye|yellow dye|orange dye|blue dye|gold bar|cabbage)$/i);
      await withdrawFromDraynorBank(c, [/^coins$/i, /^bronze sword$/i, /^wooden shield$/i]);
      if (has(sdk, /^bronze sword$/i)) await bot.equipItem(/^bronze sword$/i);
      if (has(sdk, /^wooden shield$/i)) await bot.equipItem(/^wooden shield$/i);

      const w = await bot.walkTo(3045, 3257, 2);
      if (!w?.success) { await openNearbyDoors(c, 3044, 3259, 2); await bot.walkTo(3045, 3257, 2); }
      if (!(await talk(c, /^bartender$/i, [/not very busy in here today/i, /rumours in here/i]))) return false;
      started = true;
      return true;
    });

    const dyes = () => step(c, N, 'dyes', async () => {
      if (has(sdk, /^gold bar$/i)) return true;
      const haveOrange = has(sdk, /^orange dye|orange goblin mail$/i);
      const haveBlue = has(sdk, /^blue dye|blue goblin mail$/i);
      if (haveOrange && haveBlue) return true;

      if (count(sdk, /^cabbage$/i) < 10 && (sdk.getInventory()?.length ?? 0) < 18) {
        await bot.walkTo(3054, 3285, 3);
        for (let i = 0; i < 14 && count(sdk, /^cabbage$/i) < 10 && (sdk.getInventory()?.length ?? 0) < 18; i++) {
          const before = count(sdk, /^cabbage$/i);
          await bot.interactLoc(/^cabbage$/i, /^pick$/i);
          await waitCond(() => count(sdk, /^cabbage$/i) > before, 3000, 300);
        }
      }

      if ((sdk.findInventoryItem(/^coins$/i)?.count ?? 0) < 35 || xp(sdk, 'Attack') < 1000 || xp(sdk, 'Strength') < 1000) {
        if ((sdk.getState()?.player?.worldX ?? 3050) < 3120) await bot.walkTo(3110, 3250, 3);
        if ((sdk.getState()?.player?.worldX ?? 3110) < 3200) await bot.walkTo(3185, 3245, 3);
        await bot.walkTo(3248, 3240, 3);
        const deadline = Date.now() + 240_000;
        while (
          Date.now() < deadline &&
          ((sdk.findInventoryItem(/^coins$/i)?.count ?? 0) < 40 || xp(sdk, 'Attack') < 1000 || xp(sdk, 'Strength') < 1000)
        ) {
          await bot.dismissBlockingUI();
          const p = sdk.getState()?.player;
          if (p && p.hp <= 6) {
            const food = sdk.findInventoryItem(/^(cabbage|shrimps|bread|beer)$/i);
            if (food) await bot.eatFood(food);
          }
          if (p && Math.hypot(p.worldX - 3248, p.worldZ - 3240) > 18) {
            await bot.walkTo(3248, 3240, 3);
          }
          await sdk.sendSetCombatStyle(xp(sdk, 'Attack') < 1000 ? 0 : 1);
          const mail = sdk.findGroundItem(/^goblin mail$/i);
          if (mail && totalMails() < 3) { await bot.pickupItem(mail); await sleep(600); }
          const gc = sdk.findGroundItem(/^coins$/i);
          if (gc) { await bot.pickupItem(gc); await sleep(600); }
          const dag = sdk.findGroundItem(/^iron dagger$/i);
          if (dag && (sdk.getInventory()?.length ?? 0) < 25) { await bot.pickupItem(dag); await sleep(600); }
          const px = sdk.getState()?.player?.worldX ?? 3248;
          const pz = sdk.getState()?.player?.worldZ ?? 3240;
          const gob = (sdk.getState()?.nearbyNpcs ?? [])
            .filter((n: any) => /^goblin$/i.test(n.name) && n.combatLevel <= 5 && n.x >= 3242 && n.x <= 3260 && n.z >= 3225 && n.z <= 3252)
            .sort((a: any, b: any) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
          if (gob && !sdk.getState()?.player?.combat?.inCombat) await bot.attack(gob);
          await sleep(700);
        }
        if ((sdk.findInventoryItem(/^coins$/i)?.count ?? 0) < 35 && has(sdk, /^iron dagger$/i)) {
          await bot.walkTo(3212, 3246, 2);
          const o = await bot.openShop(/^shop keeper$/i);
          if (o?.success) {
            await bot.sellToShop(/^iron dagger$/i, 'all');
            await bot.closeShop();
          }
        }
      }

      if (!haveOrange && !has(sdk, /^red dye$/i) && count(sdk, /^redberries$/i) < 3) {
        if (!(await walkToVarrock(c, 3267, 3371))) return false;
        const deadline = Date.now() + 90_000;
        while (Date.now() < deadline && count(sdk, /^redberries$/i) < 3) {
          const g = sdk.findGroundItem(/^redberries$/i);
          if (g) {
            const before = count(sdk, /^redberries$/i);
            await bot.pickupItem(g);
            await waitCond(() => count(sdk, /^redberries$/i) > before, 4000, 300);
          } else {
            await bot.walkTo(3271, 3366, 2);
            await sleep(1500);
            await bot.walkTo(3267, 3371, 2);
            await sleep(1500);
          }
        }
        if (count(sdk, /^redberries$/i) < 3) return false;
      }

      if ((sdk.getState()?.player?.worldZ ?? 0) > 3350) {
        if (!(await walkFromVarrockToLumbridge(c, 3188, 3266))) return false;
      }

      if (!haveOrange && !has(sdk, /^yellow dye$/i) && count(sdk, /^onion$/i) < 2) {
        const wo = await bot.walkTo(3188, 3266, 2);
        if (!wo?.success) { await openNearbyDoors(c, 3186, 3268, 2); await bot.walkTo(3188, 3266, 2); }
        for (let i = 0; i < 6 && count(sdk, /^onion$/i) < 2; i++) {
          const before = count(sdk, /^onion$/i);
          await bot.interactLoc(/^onion$/i, 'Pick');
          await waitCond(() => count(sdk, /^onion$/i) > before, 4000, 300);
        }
        if (count(sdk, /^onion$/i) < 2) return false;
      }

      if (!haveBlue && count(sdk, /^woad leaf$/i) < 2) {
        await bot.walkTo(3066, 3285, 3);
        for (let i = 0; i < 14 && count(sdk, /^cabbage$/i) < 12 && (sdk.getInventory()?.length ?? 0) < 20; i++) {
          const before = count(sdk, /^cabbage$/i);
          await bot.interactLoc(/^cabbage$/i, /^pick$/i);
          await waitCond(() => count(sdk, /^cabbage$/i) > before, 3000, 300);
        }
        await bot.walkTo(3007, 3330, 3);
        const ww = await bot.walkTo(3027, 3379, 2);
        if (!ww?.success) { await openNearbyDoors(c, 3027, 3382, 2); await bot.walkTo(3027, 3379, 2); }
        await talk(c, /^wyson/i, [/looking for woad leaves/i, /20 coins/i]);
        if (!(await waitCond(() => count(sdk, /^woad leaf$/i) >= 2, 4000))) return false;
      }

      if ((sdk.getState()?.player?.worldZ ?? 0) > 3310) {
        await bot.walkTo(3007, 3330, 3);
        await bot.walkTo(3050, 3275, 3);
      }
      const wa = await bot.walkTo(3086, 3259, 2);
      if (!wa?.success) { await openNearbyDoors(c, 3088, 3259, 2); await bot.walkTo(3086, 3259, 2); }

      if (!haveOrange && !has(sdk, /^red dye$/i)) {
        await talk(c, /^aggie$/i, [/make dyes for me/i, /red dye/i, /make me some red dye/i]);
        if (!(await waitInv(sdk, /^red dye$/i, 4000))) return false;
      }
      if (!haveOrange && !has(sdk, /^yellow dye$/i)) {
        await talk(c, /^aggie$/i, [/make dyes for me/i, /yellow dye/i, /make me some yellow dye/i]);
        if (!(await waitInv(sdk, /^yellow dye$/i, 4000))) return false;
      }
      if (!haveBlue) {
        await talk(c, /^aggie$/i, [/make dyes for me/i, /blue dye/i, /make me some blue dye/i]);
        if (!(await waitInv(sdk, /^blue dye$/i, 4000))) return false;
      }
      if (!haveOrange) {
        if (!(await combineItems(c, /^red dye$/i, /^yellow dye$/i, /^orange dye$/i))) return false;
      }
      return true;
    });

    const mails = () => step(c, N, 'goblin-mails', async () => {
      if (has(sdk, /^gold bar$/i)) return true;
      if (totalMails() < 3) {
        if ((sdk.getState()?.player?.worldZ ?? 0) < 3320) {
          await bot.walkTo(3050, 3275, 3);
          await bot.walkTo(3007, 3330, 3);
        }
        await bot.walkTo(2965, 3385, 3);
        await bot.walkTo(2956, 3450, 3);
        await bot.walkTo(2956, 3500, 2);
        await sdk.sendSetCombatStyle(1);
        const deadline = Date.now() + 420_000;
        while (Date.now() < deadline && totalMails() < 3) {
          await bot.dismissBlockingUI();
          const p = sdk.getState()?.player;
          if (p && p.hp <= 7) {
            const food = sdk.findInventoryItem(/^(cabbage|shrimps|bread|beer)$/i);
            if (food) await bot.eatFood(food);
          }
          if (p && (p.worldZ > 3504 || p.worldX < 2953 || p.worldX > 2962)) {
            await openNearbyDoors(c, p.worldX, p.worldZ, 4);
            await bot.walkTo(2956, 3500, 2);
          }
          const mail = sdk.findGroundItem(/^goblin mail$/i);
          if (mail) {
            const before = totalMails();
            if (!mail.reachable) await openNearbyDoors(c, mail.x, mail.z, 3);
            await bot.pickupItem(mail);
            await waitCond(() => totalMails() > before, 4000, 300);
            continue;
          }
          const px = p?.worldX ?? 2956;
          const pz = p?.worldZ ?? 3500;
          const gob = (sdk.getState()?.nearbyNpcs ?? [])
            .filter((n: any) => /^goblin$/i.test(n.name) && n.combatLevel <= 5 && n.x >= 2953 && n.x <= 2962 && n.z >= 3495 && n.z <= 3504)
            .sort((a: any, b: any) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
          if (gob && !sdk.getState()?.player?.combat?.inCombat) {
            await bot.attack(gob);
          }
          await sleep(700);
        }
        if (totalMails() < 3) return false;
      }

      if (has(sdk, /^orange dye$/i) && !has(sdk, /^orange goblin mail$/i)) {
        if (!(await combineItems(c, /^orange dye$/i, /^goblin mail$/i, /^orange goblin mail$/i))) return false;
      }
      if (has(sdk, /^blue dye$/i) && !has(sdk, /^blue goblin mail$/i)) {
        if (!(await combineItems(c, /^blue dye$/i, /^goblin mail$/i, /^blue goblin mail$/i))) return false;
      }
      return true;
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (has(sdk, /^gold bar$/i)) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) < 3320) {
        await bot.walkTo(3050, 3275, 3);
        await bot.walkTo(3007, 3330, 3);
      }
      if ((sdk.getState()?.player?.worldZ ?? 0) < 3480) {
        await bot.walkTo(2965, 3385, 3);
        await bot.walkTo(2956, 3450, 3);
      }
      const wg = await bot.walkTo(2957, 3511, 2);
      if (!wg?.success) { await openNearbyDoors(c, 2958, 3510, 2); await bot.walkTo(2957, 3511, 2); }

      await talk(c, /^general wartface$/i, [/pick an armour colour for you/i]);
      if (has(sdk, /^orange goblin mail$/i)) {
        await talk(c, /^general wartface$/i);
        await waitCond(() => !has(sdk, /^orange goblin mail$/i), 4000);
      }
      if (has(sdk, /^blue goblin mail$/i)) {
        await talk(c, /^general wartface$/i);
        await waitCond(() => !has(sdk, /^blue goblin mail$/i), 4000);
      }
      if (has(sdk, /^goblin mail$/i)) {
        await talk(c, /^general wartface$/i);
        await waitCond(() => has(sdk, /^gold bar$/i), 5000);
      }
      const done = await waitCond(() => has(sdk, /^gold bar$/i), 5000);
      await bot.closeInterface();
      return done;
    });

    return (await startPortSarim()) && (await dyes()) && (await mails()) && (await handIn());
  },
};
