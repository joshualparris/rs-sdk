import {
  Ctx, Quest, has, xp, lvl, log, sleep, talk, chat, waitCond, step,
  bankJunk, withdrawFromDraynorBank, openNearbyDoors, exitWizardsTowerGround
} from '../quest-kit';

const N = 'Imp Catcher';
const KEEP_RE = /^(red bead|yellow bead|black bead|white bead|amulet of accuracy|silverlight|bronze sword|iron|steel|mithril|adamant|rune|wooden shield|shrimps|anchovies|bread|cooked meat|cooked chicken|pie|cake|trout|salmon|lobster)$/i;

export const imp: Quest = {
  name: N,
  async run(c: Ctx) {
    const { bot, sdk } = c;
    let started = false;
    let questComplete = false;

    const hasAllBeads = () =>
      has(sdk, /^red bead$/i) &&
      has(sdk, /^yellow bead$/i) &&
      has(sdk, /^black bead$/i) &&
      has(sdk, /^white bead$/i);

    const climbWizardsTower = async (targetLevel: number) => {
      for (let g = 0; g < 8 && lvl(sdk) !== targetLevel; g++) {
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

    const startQuest = () => step(c, N, 'start-mizgog', async () => {
      if (started || questComplete) return true;
      if (lvl(sdk) > 0 && Math.hypot((sdk.getState()?.player?.worldX ?? 0) - 3104, (sdk.getState()?.player?.worldZ ?? 0) - 3160) < 15) {
        await climbWizardsTower(0);
      }
      await exitWizardsTowerGround(c);
      await bankJunk(c, KEEP_RE);
      await withdrawFromDraynorBank(c, [
        /^red bead$/i, /^yellow bead$/i, /^black bead$/i, /^white bead$/i,
        /^amulet of accuracy$/i, /^silverlight$/i, /^bronze sword$/i, /^wooden shield$/i,
      ]);
      for (const w of [/^silverlight$/i, /^rune/i, /^adamant/i, /^mithril/i, /^steel/i, /^iron/i, /^bronze sword$/i, /^wooden shield$/i]) {
        if (has(sdk, w)) { await bot.equipItem(w); await sleep(300); }
      }

      await bot.walkTo(3108, 3168, 2);
      if (!(await climbWizardsTower(2))) return false;
      await bot.walkTo(3104, 3162, 2);

      const magicBefore = xp(sdk, 'Magic');
      if (!(await talk(c, /^wizard mizgog$/i, [/give me a quest!$/i, /give me a quest please/i, /got any more quests/i]))) return false;
      const recent = (sdk.getState()?.recentDialogs ?? []).flatMap((d: any) => d.text ?? []).join(' ');
      if (/everything is good with the world today|here's your reward then|amulet of accuracy/i.test(recent) || xp(sdk, 'Magic') > magicBefore) {
        questComplete = true;
        await climbWizardsTower(0);
        await exitWizardsTowerGround(c);
        return true;
      }
      if (/could you get my beads back|how are you doing finding my beads|well get on with it|come back when you have them all/i.test(recent)) {
        started = true;
        if (!hasAllBeads()) {
          await climbWizardsTower(0);
          await exitWizardsTowerGround(c);
        }
        return true;
      }
      return false;
    });

    const farmBeads = () => step(c, N, 'collect-beads', async () => {
      if (questComplete || hasAllBeads()) return true;
      if (lvl(sdk) > 0) await climbWizardsTower(0);
      await exitWizardsTowerGround(c);

      const needBead = (name: string) => {
        if (/^red bead$/i.test(name)) return !has(sdk, /^red bead$/i);
        if (/^yellow bead$/i.test(name)) return !has(sdk, /^yellow bead$/i);
        if (/^black bead$/i.test(name)) return !has(sdk, /^black bead$/i);
        if (/^white bead$/i.test(name)) return !has(sdk, /^white bead$/i);
        return false;
      };

      const patrol: [number, number][] = [
        [3012, 3312],
        [3002, 3318],
        [3022, 3308],
        [3010, 3298],
      ];
      let pIdx = 0;

      const deadline = Date.now() + 25 * 60_000;
      while (Date.now() < deadline && !hasAllBeads()) {
        // Check for needed bead on the ground first
        const gBead = (sdk.getState()?.groundItems ?? [])
          .filter((g: any) => /^(red|yellow|black|white) bead$/i.test(g.name) && needBead(g.name) && g.reachable !== false && g.distance <= 15)
          .sort((a: any, b: any) => a.distance - b.distance)[0];
        if (gBead) {
          const bName = gBead.name;
          await bot.pickupItem(gBead);
          await waitCond(() => !needBead(bName), 4000, 250);
          continue;
        }

        const impNpc = (sdk.getState()?.nearbyNpcs ?? [])
          .filter((n: any) => /^imp$/i.test(n.name) && n.reachable !== false && !n.inCombat && n.distance <= 18)
          .sort((a: any, b: any) => a.distance - b.distance)[0];

        if (impNpc) {
          const lastX = impNpc.x;
          const lastZ = impNpc.z;
          await bot.attack(impNpc);
          // Wait until combat ends or imp teleports/dies
          await waitCond(() => {
            const st = sdk.getState();
            const hasGroundBead = (st?.groundItems ?? []).some((g: any) => /^(red|yellow|black|white) bead$/i.test(g.name) && needBead(g.name));
            if (hasGroundBead) return true;
            return !st?.player?.combat?.inCombat;
          }, 6000, 250);
          await sleep(400);
          // Re-check ground around where we fought
          const drop = (sdk.getState()?.groundItems ?? [])
            .filter((g: any) => /^(red|yellow|black|white) bead$/i.test(g.name) && needBead(g.name) && g.reachable !== false)
            .sort((a: any, b: any) => a.distance - b.distance)[0];
          if (drop) {
            const bName = drop.name;
            await bot.pickupItem(drop);
            await waitCond(() => !needBead(bName), 4000, 250);
          }
          continue;
        }

        const [tx, tz] = patrol[pIdx % patrol.length];
        pIdx++;
        await bot.walkTo(tx, tz, 3);
        await sleep(800);
      }

      return hasAllBeads();
    });

    const handIn = () => step(c, N, 'hand-in-mizgog', async () => {
      if (questComplete) return true;
      if (!hasAllBeads()) return false;

      if (lvl(sdk) === 0) {
        await bot.walkTo(3108, 3168, 2);
      }
      if (!(await climbWizardsTower(2))) return false;
      await bot.walkTo(3104, 3162, 2);

      const magicBefore = xp(sdk, 'Magic');
      if (!(await talk(c, /^wizard mizgog$/i))) return false;
      const done = await waitCond(() => xp(sdk, 'Magic') > magicBefore || !has(sdk, /^red bead$/i), 6000, 250);
      if (sdk.getState()?.dialog?.isOpen) await chat(c);
      await sleep(1000);
      if (sdk.getState()?.modalOpen) await bot.closeInterface();
      await climbWizardsTower(0);
      await exitWizardsTowerGround(c);
      if (done || has(sdk, /^amulet of accuracy$/i)) {
        questComplete = true;
        return true;
      }
      return false;
    });

    if (!(await startQuest())) return false;
    if (!(await farmBeads())) return false;
    if (!(await handIn())) return false;
    return true;
  },
};
