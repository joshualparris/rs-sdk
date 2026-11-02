import { runScript } from '../../sdk/runner';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
await runScript(async ({ bot, sdk }) => {
  const me = sdk.getState()?.player;
  const wheat = (sdk.getState()?.nearbyLocs ?? []).filter((l: any) => /^wheat$/i.test(l.name));
  wheat.sort((a: any, b: any) => Math.hypot(a.x - 3165, a.z - 3300) - Math.hypot(b.x - 3165, b.z - 3300));
  for (const w of wheat.slice(0, 8)) {
    const r = await bot.interactLoc(w, 'Pick');
    await sleep(3000);
    const got = !!sdk.findInventoryItem(/^grain$/i);
    console.log(`TRY ${w.x},${w.z}: ${r.success} ${r.message ?? r.reason ?? ''} grain=${got}`);
    if (got) break;
  }
}, { timeout: 90_000 });
