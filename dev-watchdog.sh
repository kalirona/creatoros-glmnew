#!/bin/bash
cd /home/z/my-project
LOG=/home/z/my-project/dev.log
WLOG=/home/z/my-project/watchdog.log
while true; do
  if ! pgrep -f "next-server\|next dev" > /dev/null 2>&1; then
    echo "[$(date +%H:%M:%S)] starting dev server" >> "$WLOG"
    NODE_OPTIONS="--max-old-space-size=2048" bun run dev > "$LOG" 2>&1 &
    for i in 1 2 3 4 5 6 7 8 9 10; do
      sleep 2
      if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null | grep -q 200; then
        echo "[$(date +%H:%M:%S)] ready after ${i}x2s" >> "$WLOG"
        break
      fi
    done
  fi
  sleep 5
done
