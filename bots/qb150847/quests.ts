import { runQuests } from '../lib/quest-kit';
import { ALL } from '../lib/quests';
const pick = (process.env.QUESTS ?? 'cooks,sheep').split(',').map(s => (ALL as any)[s.trim()]).filter(Boolean);
await runQuests(import.meta.dir, pick);
