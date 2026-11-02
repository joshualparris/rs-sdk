import { Ctx, Quest, has, count, xp, lvl, log, sleep, talk, waitInv, waitCond, step, openNearbyDoors, walkToVarrock, walkFromVarrockToLumbridge, withdrawFromDraynorBank, draynorManorCrypt, exitWizardsTowerGround } from '../quest-kit';
const N = 'Vampyre Slayer';
const FOOD_RE = /^(shrimps|bread|cooked meat|kebab|trout|salmon|cabbage)$/i;

export const vampire: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let alreadyComplete = xp(sdk, 'Attack') >= 48250;

    const morgan = () => step(c, N, 'morgan-and-garlic', async () => {
      if (alreadyComplete) return true;
      await exitWizardsTowerGround(c);
      if (lvl(sdk) === 0) {
        if ((sdk.getState()?.player?.worldX ?? 0) < 3010 && (sdk.getState()?.player?.worldZ ?? 0) > 3350) {
          await bot.walkTo(2965, 3385, 3);
          await bot.walkTo(3007, 3330, 3);
          await bot.walkTo(3050, 3275, 3);
        }
        const w = await bot.walkTo(3098, 3268, 2);
        if (!w?.success) { await openNearbyDoors(c, 3098, 3270, 2); await bot.walkTo(3098, 3268, 2); }
        if (!has(sdk, /^stake$/i)) {
          if (!(await talk(c, /^morgan$/i, [/ok, i'm up for an adventure/i]))) return false;
          const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
          if (/slain the foul creature/i.test(recent)) { alreadyComplete = true; return true; }
        }
      }
      if (!has(sdk, /^garlic$/i)) {
        for (let i = 0; i < 3 && lvl(sdk) === 0; i++) {
          await bot.walkTo(3098, 3266, 1);
          await bot.interactLoc(/^staircase$/i, /climb-?up/i);
          await waitCond(() => lvl(sdk) === 1, 6000, 400);
        }
        if (lvl(sdk) !== 1) return false;
        await bot.walkTo(3097, 3268, 1);
        for (let i = 0; i < 3 && !has(sdk, /^garlic$/i); i++) {
          const cup = sdk.findNearbyLoc(/^cupboard$/i);
          if (cup && (cup.options ?? []).some((o: string) => /^open$/i.test(o))) {
            await bot.interactLoc(cup, /^open$/i);
            await sleep(900);
          }
          await bot.interactLoc(/^cupboard$/i, /^search$/i);
          if (await waitInv(sdk, /^garlic$/i, 2500)) break;
        }
        for (let i = 0; i < 3 && lvl(sdk) === 1; i++) {
          await bot.walkTo(3101, 3266, 1);
          await bot.interactLoc(/^staircase$/i, /climb-?down/i);
          await waitCond(() => lvl(sdk) === 0, 6000, 400);
        }
      }
      return has(sdk, /^garlic$/i);
    });

    const prep = () => step(c, N, 'prep', async () => {
      if (alreadyComplete) return true;
      await withdrawFromDraynorBank(c, [/^coins$/i, /^bronze sword$/i, /^wooden shield$/i, /^shrimps$/i, /^bread$/i]);
      if (has(sdk, /^bronze sword$/i)) await bot.equipItem(/^bronze sword$/i);
      if (has(sdk, /^wooden shield$/i)) await bot.equipItem(/^wooden shield$/i);
      if (!has(sdk, /^hammer$/i)) {
        const w = await bot.walkTo(3212, 3247, 2);
        if (!w?.success) { await openNearbyDoors(c, 3212, 3247, 2); await bot.walkTo(3212, 3247, 2); }
        for (let i = 0; i < 3 && !has(sdk, /^hammer$/i); i++) {
          const o = await bot.openShop();
          if (o?.success) {
            await bot.buyFromShop(/^hammer$/i, 1);
            await bot.closeShop();
          }
          await sleep(600);
        }
      }
      if (xp(sdk, 'Strength') < 2500 || xp(sdk, 'Attack') < 1500 || xp(sdk, 'Defence') < 1500) {
        const wc = await bot.walkTo(3232, 3297, 3);
        if (!wc?.success) { await openNearbyDoors(c, 3236, 3295, 2); await bot.walkTo(3232, 3297, 3); }
        const goals: [string, number, number][] = [
          ['Strength', 2500, 1],
          ['Attack', 1500, 0],
          ['Defence', 1500, 3],
        ];
        for (const [skill, targetXp, style] of goals) {
          if (xp(sdk, skill) >= targetXp) continue;
          await sdk.sendSetCombatStyle(style);
          const deadline = Date.now() + 90_000;
          while (Date.now() < deadline && xp(sdk, skill) < targetXp) {
            await bot.dismissBlockingUI();
            const chk = (sdk.getState()?.nearbyNpcs ?? []).find((n: any) => /^chicken$/i.test(n.name) && n.x >= 3225 && n.x <= 3236 && n.z >= 3288 && n.z <= 3301);
            if (chk && !sdk.getState()?.player?.combat?.inCombat) {
              await bot.attack(chk);
            }
            await sleep(700);
          }
        }
        await sdk.sendSetCombatStyle(1);
      }
      if (count(sdk, FOOD_RE) < 12) {
        const w = await bot.walkTo(3194, 3285, 3);
        if (!w?.success) { await openNearbyDoors(c, 3194, 3285, 2); await bot.walkTo(3194, 3285, 3); }
        for (let i = 0; i < 18 && count(sdk, FOOD_RE) < 14 && (sdk.getInventory()?.length ?? 0) < 25; i++) {
          const before = count(sdk, /^cabbage$/i);
          await bot.interactLoc(/^cabbage$/i, /^pick$/i);
          await waitCond(() => count(sdk, /^cabbage$/i) > before, 3000, 300);
        }
      }
      return has(sdk, /^hammer$/i);
    });

    const stake = () => step(c, N, 'stake', async () => {
      if (alreadyComplete || has(sdk, /^stake$/i)) return true;
      if (!(await walkToVarrock(c, 3277, 3488))) return false;
      for (let round = 0; round < 3 && !has(sdk, /^stake$/i); round++) {
        if (!has(sdk, /^beer$/i)) {
          const w = await bot.walkTo(3277, 3488, 2);
          if (!w?.success) { await openNearbyDoors(c, 3277, 3485, 2); await bot.walkTo(3277, 3488, 2); }
          await talk(c, /^bartender$/i, [/beer please/i]);
          await waitInv(sdk, /^beer$/i, 3000);
        }
        const w2 = await bot.walkTo(3277, 3491, 2);
        if (!w2?.success) { await openNearbyDoors(c, 3277, 3485, 2); await bot.walkTo(3277, 3491, 2); }
        await talk(c, /^dr harlow$/i, [/morgan needs your help/i, /ok mate/i]);
        if (await waitInv(sdk, /^stake$/i, 3000)) return true;
      }
      return has(sdk, /^stake$/i);
    });

    const slay = () => step(c, N, 'slay', async () => {
      if (alreadyComplete) return true;
      if ((sdk.getState()?.player?.worldZ ?? 0) > 3380 && (sdk.getState()?.player?.worldZ ?? 0) < 9000) {
        if (!(await walkFromVarrockToLumbridge(c, 3123, 3362))) return false;
      }
      if (!(await draynorManorCrypt(c, true))) return false;
      await bot.walkTo(3078, 9775, 2);
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline && xp(sdk, 'Attack') < 48250) {
        await bot.dismissBlockingUI();
        const p = sdk.getState()?.player;
        if (p && p.hp <= 7) {
          const food = sdk.findInventoryItem(FOOD_RE);
          if (food) await bot.eatFood(food);
        }
        let vamp = sdk.findNearbyNpc(/^count draynor$/i);
        if (!vamp) {
          const coffin = sdk.findNearbyLoc(/^coffin$/i);
          if (coffin && (coffin.options ?? []).some((o: string) => /^open$/i.test(o))) {
            await bot.interactLoc(coffin, /^open$/i);
            await waitCond(() => !!sdk.findNearbyNpc(/^count draynor$/i), 5000, 400);
            vamp = sdk.findNearbyNpc(/^count draynor$/i);
          }
        }
        if (vamp && !sdk.getState()?.player?.combat?.inCombat) {
          await bot.attack(vamp);
        }
        await sleep(800);
      }
      const done = await waitCond(() => xp(sdk, 'Attack') >= 48250, 6000);
      await bot.closeInterface();
      await draynorManorCrypt(c, false);
      return done;
    });

    return (await morgan()) && (await prep()) && (await stake()) && (await slay());
  },
};
