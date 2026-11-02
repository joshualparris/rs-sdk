import { Ctx, Quest, has, count, xp, lvl, log, sleep, talk, chat, waitCond, step, bankJunk, lumbridgeStairs, pickupWithWait } from '../quest-kit';
const N = 'Sheep Shearer';
const FRED = [3189, 3273] as const;
const SHEARS = [3152, 3306] as const;
const PEN = [3201, 3268] as const;
const WHEEL = [3209, 3213] as const;

async function shearOne(c: Ctx) {
  const { bot, sdk } = c;
  const before = count(sdk, /^wool$/i);
  const me = sdk.getState()?.player ?? {};
  // NPC id 43 = sheepunsheered, 42 = sheepsheered (from server/content/pack/npc.pack)
  const sheep = (sdk.getState()?.nearbyNpcs ?? [])
    .filter((n: any) => /^sheep$/i.test(n.name) && (n.id === undefined || n.id === 43) && n.reachable !== false)
    .sort((a: any, b: any) => Math.hypot(a.x - me.worldX, a.z - me.worldZ) - Math.hypot(b.x - me.worldX, b.z - me.worldZ));
  if (!sheep.length) { await sleep(1000); return false; }
  for (const s of sheep.slice(0, 3)) {
    await bot.useItemOnNpc(/^shears$/i, s);
    if (await waitCond(() => count(sdk, /^wool$/i) > before, 3500, 250)) {
      if (sdk.getState()?.dialog?.isOpen) await sdk.sendClickDialog(0);
      return true;
    }
  }
  return false;
}

export const sheep: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    if (xp(sdk, 'Crafting') >= 1500) { log(c, 'already completed'); return true; }
    // True if we already spun 20 balls of wool (>=1250 Crafting XP at 25x or >=50 at 1x) and have remaining ball(s) to hand in
    const alreadySpun = () => xp(sdk, 'Crafting') >= 50 && count(sdk, /ball of wool/i) >= 1 && count(sdk, /^wool$/i) === 0;

    const bank = () => step(c, N, 'bank', async () => {
      if (alreadySpun() || count(sdk, /^(wool|ball of wool)$/i) >= 20) return true;
      return bankJunk(c);
    });

    const start = () => step(c, N, 'start', async () => {
      if (alreadySpun() || count(sdk, /^(wool|ball of wool)$/i) > 0) return true;
      if (lvl(sdk) > 0 && !(await lumbridgeStairs(c, 0))) return false;
      await bot.walkTo(...FRED);
      return talk(c, /^fred the farmer$/i, [/looking for a quest|any quests/i, /yes|okay|i can do that/i]);
    });

    const shears = () => step(c, N, 'shears', async () => {
      if (alreadySpun() || count(sdk, /^(wool|ball of wool)$/i) >= 20 || has(sdk, /^shears$/i)) return true;
      if (lvl(sdk) > 0 && !(await lumbridgeStairs(c, 0))) return false;
      return pickupWithWait(c, SHEARS[0], SHEARS[1], /^shears$/i, 25);
    });

    const wool = () => step(c, N, 'wool', async () => {
      if (alreadySpun() || count(sdk, /^(wool|ball of wool)$/i) >= 20) return true;
      if (lvl(sdk) > 0 && !(await lumbridgeStairs(c, 0))) return false;
      await bot.walkTo(...PEN); await sleep(1000);
      let misses = 0;
      while (count(sdk, /^wool$/i) + count(sdk, /ball of wool/i) < 20 && misses < 40) {
        if (!(await shearOne(c))) misses++;
      }
      return count(sdk, /^wool$/i) + count(sdk, /ball of wool/i) >= 20;
    });

    const spin = () => step(c, N, 'spin', async () => {
      if (alreadySpun() || count(sdk, /ball of wool/i) >= 20) return true;
      if (!(await lumbridgeStairs(c, 1))) return false;
      await bot.walkTo(...WHEEL, 1);
      for (let i = 0; i < 40 && count(sdk, /^wool$/i) > 0; i++) {
        const before = count(sdk, /ball of wool/i);
        await bot.useItemOnLoc(/^wool$/i, /spinning wheel/i);
        await waitCond(() => count(sdk, /ball of wool/i) > before, 3500, 250);
      }
      return count(sdk, /ball of wool/i) >= 20;
    });

    const handIn = () => step(c, N, 'hand-in', async () => {
      if (xp(sdk, 'Crafting') >= 1500) return true;
      if (lvl(sdk) > 0 && !(await lumbridgeStairs(c, 0))) return false;
      await bot.walkTo(...FRED);
      for (let round = 0; round < 3 && xp(sdk, 'Crafting') < 1500; round++) {
        if (sdk.getState()?.dialog?.isOpen) {
          await chat(c);
        } else {
          if (!(await talk(c, /^fred the farmer$/i))) return false;
        }
        // Wait while Fred takes balls of wool 1 per tick (p_delay(1)) with dialog closed, then re-opens dialog on the 20th ball
        const end = Date.now() + 18_000;
        while (Date.now() < end && xp(sdk, 'Crafting') < 1500) {
          if (sdk.getState()?.dialog?.isOpen) {
            await chat(c);
          }
          await sleep(400);
        }
      }
      await bot.closeInterface();
      return xp(sdk, 'Crafting') >= 1500 && count(sdk, /ball of wool/i) === 0;
    });

    return (await bank()) && (await start()) && (await shears()) && (await wool()) && (await spin()) && (await handIn());
  },
};
