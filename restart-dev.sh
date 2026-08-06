#!/bin/bash
cd /home/z/my-project
if ! pgrep -f "next dev" > /dev/null 2>&1; then
  NODE_OPTIONS="--max-old-space-size=640" bun run dev > /home/z/my-project/dev.log 2>&1 &
  disown
fi
