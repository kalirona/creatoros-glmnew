#!/bin/bash
cd /home/z/my-project
echo "START $(date +%s)" > ai-test-progress.txt
RESP=$(curl -s --max-time 180 -X POST "http://localhost:3000/api/ai/images" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"mountain sunset","style":"Cinematic","aspectRatio":"16:9"}')
echo "RESP $(date +%s)" >> ai-test-progress.txt
echo "$RESP" >> ai-test-progress.txt
ASSET_ID=$(echo "$RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('assetId',''))" 2>/dev/null)
echo "ASSET_ID=$ASSET_ID" >> ai-test-progress.txt
if [ -n "$ASSET_ID" ] && [ "$ASSET_ID" != "" ]; then
  echo "USE_TEST $(date +%s)" >> ai-test-progress.txt
  curl -s --max-time 30 -X POST "http://localhost:3000/api/ai/assets/$ASSET_ID/use" \
    -H "Content-Type: application/json" \
    -d '{"module":"course","entityName":"Test Course"}' >> ai-test-progress.txt
  echo "" >> ai-test-progress.txt
fi
echo "DONE $(date +%s)" >> ai-test-progress.txt
