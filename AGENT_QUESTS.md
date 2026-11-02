# Quest automation rules
Goal: each quest in bots/lib/quests/<quest>.ts completes on a FRESH bot, unattended.

Loop: scripts/run-fresh.sh -> read bots/<bot>/failures/*.json -> fix -> rerun on a NEW bot.

Rules
1. Never guess NPC names, loc names, options or dialog lines. Read them from
   server/content/scripts/quests/quest_<x>/*.rs2, the loc/npc configs, and wiki/quests/<x>.md.
2. Each step goes through step(); it must skip itself if its result is already in the inventory.
3. Check results (item arrived, XP gained), not just `success: true`. interactLoc success only means it started.
4. Try several targets (wheat tiles, doors) before declaring failure.
5. Floors: ladders and stairs change level; objects only appear on their own level. Check the .rs2 coordinates (level_x_z).
6. Pathing: avoid Draynor Manor's front door (3108,3353). See learnings/draynor-manor.md.
7. One controller per bot. Do not run two scripts against the same bot.
8. Don't commit bots/*/bot.env.
9. A quest is done when the completion scroll/"Quest complete" appears. Add a verify step per quest.
