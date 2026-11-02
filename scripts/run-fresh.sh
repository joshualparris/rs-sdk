#!/usr/bin/env bash
# usage: scripts/run-fresh.sh   (needs engine, webclient and gateway already running)
set -e
cd "$(dirname "$0")/.."
NAME="qb$(date +%H%M%S)"
bun bots/create-bot.ts "$NAME" >/dev/null
sed -i 's/^SERVER=.*/SERVER=/' "bots/$NAME/bot.env"
PW=$(grep '^PASSWORD=' "bots/$NAME/bot.env" | cut -d= -f2)
sed "s#'./lib#'../lib#" bots/bob_template.ts > "bots/$NAME/quests.ts"
xdg-open "http://localhost:8888/bot?bot=$NAME&password=$PW" >/dev/null 2>&1 &
echo "bot=$NAME  waiting 20s for the client to attach..."; sleep 20
bun "bots/$NAME/quests.ts" || true
echo "log:       bots/$NAME/lab_log.md"
echo "snapshots: bots/$NAME/failures/"
