import { join } from 'path';
import {
  walkFromVarrockToLumbridge,
  exitWizardsTowerGround,
  wizardsTowerBasement,
  draynorManorCrypt,
  lumbridgeStairs,
  julietStairs,
  openNearbyDoors,
  chat,
  waitCond,
  sleep,
  lvl,
  count,
} from './quest-kit';

export default async function walkToLumbridge({
  bot,
  sdk,
  args,
}: {
  bot: any;
  sdk: any;
  args?: { idx?: number; botName?: string };
}) {
  const idx = Number(args?.idx ?? 0);
  const botName = args?.botName ?? sdk.getState()?.player?.name ?? 'bot';
  const c = { bot, sdk, dir: join(import.meta.dir, '..', String(botName).toLowerCase()) };

  const st0 = sdk.getState();
  if (
    st0?.inTutorial ||
    ((st0?.player?.worldZ ?? 0) >= 3060 &&
      (st0?.player?.worldZ ?? 0) <= 3135 &&
      (st0?.player?.worldX ?? 0) >= 3055 &&
      (st0?.player?.worldX ?? 0) <= 3155)
  ) {
    console.log(`[${botName}] Skipping tutorial...`);
    await bot.skipTutorial();
    await sleep(1000);
  }

  // Close any open modal or dialog
  if (sdk.getState()?.modalOpen || sdk.getState()?.interface?.isOpen) {
    await bot.closeInterface();
  }
  if (sdk.getState()?.dialog?.isOpen) {
    const p = sdk.getState()?.player;
    if (p) await sdk.sendWalk(p.worldX, p.worldZ, true);
    await sleep(600);
  }

  // Escape underground / cellars (worldZ > 9000)
  const pu = sdk.getState()?.player;
  if (pu && pu.worldZ > 9000) {
    if (pu.worldZ > 9700) {
      await draynorManorCrypt(c, false);
    } else if (pu.worldZ >= 9500 && pu.worldZ <= 9650) {
      await wizardsTowerBasement(c, false);
    } else {
      for (let i = 0; i < 4 && (sdk.getState()?.player?.worldZ ?? 0) > 9000; i++) {
        const up = (sdk.getState()?.nearbyLocs ?? [])
          .filter(
            (l: any) =>
              /ladder|stair|trapdoor/i.test(l.name) &&
              (l.options ?? []).some((o: string) => /climb-?up|walk-?up/i.test(o)),
          )
          .sort((a: any, b: any) => a.distance - b.distance)[0];
        if (!up) break;
        await bot.interactLoc(up, /climb-?up|walk-?up/i);
        await waitCond(() => (sdk.getState()?.player?.worldZ ?? 0) < 9000, 6000, 300);
      }
    }
  }

  // If in Draynor Manor (3090..3127, 3353..3375)
  const pd = sdk.getState()?.player;
  if (pd && pd.worldX >= 3090 && pd.worldX <= 3127 && pd.worldZ >= 3353 && pd.worldZ <= 3375) {
    if (lvl(sdk) === 2) {
      await bot.walkTo(3105, 3364, 1);
      const st = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 11511 || /stair/i.test(l.name));
      if (st) {
        await bot.interactLoc(st, /climb-?down/i);
        await waitCond(() => lvl(sdk) === 1, 6000, 250);
      }
    }
    if (lvl(sdk) === 1) {
      await bot.walkTo(3109, 3366, 2);
      const st = (sdk.getState()?.nearbyLocs ?? []).find(
        (l: any) =>
          l.id === 11499 || (/stair/i.test(l.name) && (l.options ?? []).some((o: string) => /climb-?down/i.test(o))),
      );
      if (st) {
        await bot.interactLoc(st, /climb-?down/i);
        await waitCond(() => lvl(sdk) === 0, 6000, 250);
      }
    }
    if (lvl(sdk) === 0) {
      await bot.walkTo(3108, 3361, 2);
      await openNearbyDoors(c, 3112, 3360, 4);
      await bot.walkTo(3115, 3359, 2);
      await openNearbyDoors(c, 3119, 3359, 4);
      await bot.walkTo(3123, 3360, 2);
      await openNearbyDoors(c, 3123, 3360, 4);
      await bot.walkTo(3128, 3360, 2);
      await bot.walkTo(3128, 3350, 2);
      await bot.walkTo(3109, 3345, 3);
    }
  }

  // Climb down if on any other upper floor
  for (let g = 0; g < 4 && lvl(sdk) > 0; g++) {
    const p = sdk.getState()?.player;
    if (p && Math.hypot(p.worldX - 3205, p.worldZ - 3209) < 20) {
      await lumbridgeStairs(c, 0);
    } else if (p && p.worldX >= 3148 && p.worldX <= 3164 && p.worldZ >= 3426 && p.worldZ <= 3440) {
      await julietStairs(c, 0);
    } else {
      const st = (sdk.getState()?.nearbyLocs ?? [])
        .filter(
          (l: any) =>
            /stair|ladder/i.test(l.name) && (l.options ?? []).some((o: string) => /climb-?down/i.test(o)),
        )
        .sort((x: any, y: any) => x.distance - y.distance)[0];
      if (st) {
        const cur = lvl(sdk);
        await bot.interactLoc(st, /climb-?down/i);
        await waitCond(() => lvl(sdk) < cur, 5000, 250);
      } else {
        break;
      }
    }
  }

  await exitWizardsTowerGround(c);

  const p = sdk.getState()?.player;
  // If on Karamja
  if (p && p.worldX < 2965 && p.worldZ < 3200) {
    const rum = sdk.findInventoryItem(/rum/i);
    if (rum) {
      await sdk.sendDropItem(rum.slot);
      await sleep(800);
    }
    if (count(sdk, /^coins$/i) < 30) {
      console.log(`[${botName}] Earning 30gp from Luthas on Karamja...`);
      await bot.walkTo(2938, 3154, 2);
      await bot.talkTo(/^luthas$/i);
      await chat(c, [/could you offer me employment/i]);
      await bot.walkTo(2918, 3161, 3);
      while (count(sdk, /^banana$/i) < 10) {
        const tree = (sdk.getState()?.nearbyLocs ?? [])
          .filter(
            (l: any) =>
              /^banana tree$/i.test(l.name) && (l.options ?? []).some((o: string) => /search/i.test(o)),
          )
          .sort((a: any, b: any) => a.distance - b.distance)[0];
        if (!tree) {
          await sleep(1000);
          continue;
        }
        const before = count(sdk, /^banana$/i);
        await bot.interactLoc(tree, /search/i);
        await waitCond(() => count(sdk, /^banana$/i) > before, 4000, 200);
      }
      await bot.walkTo(2943, 3151, 2);
      const crate = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => l.id === 2072);
      const banana = sdk.findInventoryItem(/^banana$/i);
      if (crate && banana) {
        await bot.useItemOnLoc(banana, crate);
        await sleep(1500);
        await bot.interactLoc(crate, /fill/i);
        await sleep(2000);
      }
      await bot.walkTo(2938, 3154, 2);
      await bot.talkTo(/^luthas$/i);
      await chat(c, []);
    }
    await bot.walkTo(2954, 3147, 2);
    await bot.talkTo(/^customs officer$/i);
    await chat(c, [/can i journey on this ship/i, /search away/i, /ok/i]);
    await waitCond(() => (sdk.getState()?.player?.worldX ?? 0) > 3000, 15000, 400);
    await sleep(1500);
    const plank = (sdk.getState()?.nearbyLocs ?? []).find((l: any) => /gangplank/i.test(l.name));
    if (plank) {
      await bot.interactLoc(plank, /cross/i);
      await sleep(1500);
    }
  }

  // If in Al Kharid
  const p2 = sdk.getState()?.player;
  if (p2 && p2.worldX >= 3268 && p2.worldZ < 3330) {
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
    if ((sdk.getState()?.player?.worldX ?? 0) >= 3268) {
      await bot.walkTo(3292, 3240, 3);
      await bot.walkTo(3285, 3290, 3);
      await bot.walkTo(3283, 3332, 2);
      await bot.walkTo(3268, 3332, 2);
      await bot.walkTo(3263, 3300, 3);
      await bot.walkTo(3260, 3260, 3);
    }
  }

  // If in Varrock or north of Lumbridge
  const p3 = sdk.getState()?.player;
  if (p3 && p3.worldZ >= 3350 && p3.worldZ < 9000 && p3.worldX > 3130) {
    await walkFromVarrockToLumbridge(c, 3222, 3218);
  }

  // Walk to Lumbridge Castle courtyard (3220..3224, 3216..3220)
  const tx = 3220 + (idx % 5);
  const tz = 3216 + (Math.floor(idx / 5) % 5);
  for (let att = 0; att < 4; att++) {
    const cur = sdk.getState()?.player;
    if (cur && Math.hypot(cur.worldX - 3222, cur.worldZ - 3218) <= 6 && cur.level === 0) break;
    const w = await bot.walkTo(tx, tz, 2);
    if (!w?.success) {
      await openNearbyDoors(c, undefined, undefined, 3);
    }
  }

  const pf = sdk.getState()?.player;
  return {
    botName,
    x: pf?.worldX ?? null,
    z: pf?.worldZ ?? null,
    level: pf?.level ?? null,
    atLumbridge:
      pf != null && Math.hypot(pf.worldX - 3222, pf.worldZ - 3218) <= 8 && pf.level === 0,
  };
}
