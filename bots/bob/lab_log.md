# bob Lab Log

## Session 1

### Goals
-

### Observations
-

### Next Steps

### Possible SDK Bugs or Improvements:
-
- 2026-11-02T01:26:26.263Z START Cook's Assistant (attempt 1)
- 2026-11-02T01:27:21.464Z milk attempt: true Used Bucket on Cow
- 2026-11-02T01:27:51.479Z pick wheat 3162,3299: true Interacted with Wheat
- 2026-11-02T01:28:01.888Z ladder up: {"success":true,"message":"Interacted with Ladder"}
- 2026-11-02T01:28:04.689Z ladder up 2: {"success":true,"message":"Interacted with Ladder"}
- 2026-11-02T01:28:08.279Z hopper: true Used Grain on Hopper
- 2026-11-02T01:28:11.480Z controls: true Interacted with Hopper controls
- 2026-11-02T01:28:15.476Z ladder down 2: true Interacted with Ladder
- 2026-11-02T01:28:18.290Z ladder down: true Interacted with Ladder
- 2026-11-02T01:28:21.485Z bin: true Interacted with Flour bin
- 2026-11-02T01:29:04.243Z DONE Cook's Assistant

## Session 2 (2026-11-02 — Agy Agent 2 Autonomous Progression)
- Verified Bob's identity (`Bob`) and exclusive controller lease via `rs-jimmy` (`bot_name: "bob"`).
- Diagnosed initial `bots/bob/script.ts` hang (`disconnectAfter: false` kept the process alive after finishing; also `SkillState` uses `.experience`, not `.xp`).
- Executed Woodcutting + Firemaking in Lumbridge forest: WC 1 -> 15 (1,875 XP), FM 1 -> 15 (2,000 XP).
- Completed **The Restless Ghost**: Prayer 1 -> 47 (28,125 XP), Combat 3 -> 9.
- Completed **Doric's Quest**: Mined 6 clay, 4 copper, 2 iron at Rimmington mine; Mining 1 -> 55 (46,812 XP).
- Completed **Witch's Potion**: Obtained onion, eye of newt, rat's tail, and double-cooked beef for burnt meat; Magic 1 -> 31 (8,125 XP), Combat 9 -> 23.
- Completed **The Knight's Sword**: Smelted bronze & iron bars, smithed bronze daggers at Doric's anvil, baked Redberry pie from scratch, lured Sir Vyvin out of his room into the L2 hallway (`2983, 3337`) so he was >1 tile from the cupboard (`2984, 3336`), mined Blurite ore in the Asgarnian Ice Dungeon, forged the Blurite sword with Thurgo, and delivered to Squire. Smithing 1 -> 82 (321,555 XP)!
- Trained Thieving on Falador men: Thieving 1 -> 10 (1,000 XP).
- Trained Fishing & Cooking at Draynor: Fishing 1 -> 10 (1,000 XP), Cooking 30 -> 37 (13,200 XP).
- Started **Druidic Ritual** with Kaqemeex.
- Completed **Rune Mysteries**: Talked to Duke Horacio (Lumbridge Castle L1), Sedridor (Wizards' Tower basement), and Aubury (Varrock); mined Rune essence and crafted Air runes at Air Altar (Runecraft 1 -> 3, 250 XP).
- Completed **Sheep Shearer**: Sheared 20 wool, spun 20 balls of wool on Lumbridge Castle L1 spinning wheel, delivered to Fred the Farmer (Crafting 1 -> 25, 5,062 XP + 60 gp).
- Completed **Romeo & Juliet**: Spoke to Juliet on L1 balcony, delivered message to Romeo, spoke to Father Lawrence, brought Cadava berries to Apothecary for Cadava potion, delivered potion to Juliet, and completed quest with Romeo (+5 QP).
- Gathered at Lumbridge Castle Courtyard `(3225, 3222)` with Jimmy and the `Qb*` bots.
