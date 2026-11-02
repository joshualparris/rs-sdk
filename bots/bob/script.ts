import { runScript } from '../../sdk/runner';

await runScript(async (ctx) => {
    const { bot, sdk } = ctx;

    const initial = sdk.getState();
    if (!initial || initial.player?.name?.toLowerCase() !== 'bob') {
        throw new Error(`Expected player Bob, got: ${initial?.player?.name}`);
    }

    console.log(`Initial state: ${initial.player.name} at (${initial.player.worldX}, ${initial.player.worldZ}), tick ${initial.tick}`);
    console.log(`Initial WC XP: ${sdk.getSkill('Woodcutting')?.xp}, FM XP: ${sdk.getSkill('Firemaking')?.xp}`);

    // Walk outside Lumbridge Castle courtyard/gate area where trees grow
    const walkRes = await bot.walkTo(3202, 3218, 2);
    console.log(`Walk to (3202, 3218): ${walkRes.success} - ${walkRes.message}`);

    // Find a normal tree
    let tree = sdk.findNearbyLoc(/^tree$/i, { reachable: true });
    if (!tree) {
        await bot.walkTo(3195, 3225, 2);
        tree = sdk.findNearbyLoc(/^tree$/i, { reachable: true });
    }

    if (tree) {
        console.log(`Found tree at (${tree.x}, ${tree.z})`);
        const chopRes = await bot.chopTree(tree);
        console.log(`Chop result: ${chopRes.success} - ${chopRes.message}`);
    } else {
        console.log('No reachable tree found nearby');
    }

    // If we have logs and a tinderbox, burn the logs for Firemaking XP
    const logs = sdk.findInventoryItem(/^logs$/i);
    if (logs) {
        const burnRes = await bot.burnLogs(logs);
        console.log(`Burn result: ${burnRes.success} - ${burnRes.message}`);
    }

    const after = sdk.getState();
    console.log(`Final state: ${after?.player?.name} at (${after?.player?.worldX}, ${after?.player?.worldZ}), tick ${after?.tick}`);
    console.log(`Final WC XP: ${sdk.getSkill('Woodcutting')?.xp}, FM XP: ${sdk.getSkill('Firemaking')?.xp}`);
}, {
    timeout: 60_000,
    disconnectAfter: false,
});
