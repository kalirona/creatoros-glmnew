#!/bin/bash
# Test script that runs image gen and writes results to a file
cd /home/z/my-project

OUT=/home/z/my-project/ai-test-results.txt
> "$OUT"

echo "=== TEST 1: Image Generation ===" >> "$OUT"
RESP=$(curl -s --max-time 180 -X POST "http://localhost:3000/api/ai/images" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"mountain sunset over lake","style":"Cinematic","aspectRatio":"16:9"}')
echo "$RESP" >> "$OUT"
echo "" >> "$OUT"

# Extract IDs
ASSET_ID=$(echo "$RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('assetId',''))" 2>/dev/null)
GEN_ID=$(echo "$RESP" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('generationId',''))" 2>/dev/null)

echo "Asset ID: $ASSET_ID" >> "$OUT"
echo "Generation ID: $GEN_ID" >> "$OUT"

# Provider leak check
if echo "$RESP" | grep -qiE "providerSlug|modelId|costUsd|openrouter|fal-ai|deepseek"; then
  echo "FAIL: Provider info leaked!" >> "$OUT"
else
  echo "PASS: No provider info leaked" >> "$OUT"
fi
echo "" >> "$OUT"

echo "=== TEST 2: Media Library ===" >> "$OUT"
curl -s --max-time 30 "http://localhost:3000/api/ai/assets?folder=AI%20Images" | head -c 800 >> "$OUT"
echo "" >> "$OUT"
echo "" >> "$OUT"

echo "=== TEST 3: Admin Logs ===" >> "$OUT"
curl -s --max-time 30 "http://localhost:3000/api/admin/logs?pageSize=3" | head -c 800 >> "$OUT"
echo "" >> "$OUT"
echo "" >> "$OUT"

echo "=== TEST 4: Admin Monitoring ===" >> "$OUT"
curl -s --max-time 30 "http://localhost:3000/api/admin/monitoring" | head -c 800 >> "$OUT"
echo "" >> "$OUT"
echo "" >> "$OUT"

if [ -n "$ASSET_ID" ] && [ "$ASSET_ID" != "" ]; then
  echo "=== TEST 5: Use asset in Course ===" >> "$OUT"
  curl -s --max-time 30 -X POST "http://localhost:3000/api/ai/assets/$ASSET_ID/use" \
    -H "Content-Type: application/json" \
    -d '{"module":"course","entityName":"Mountain Photography Masterclass"}' >> "$OUT"
  echo "" >> "$OUT"
fi

echo "=== TEST 6: Admin Costs ===" >> "$OUT"
curl -s --max-time 30 "http://localhost:3000/api/admin/costs" | head -c 800 >> "$OUT"
echo "" >> "$OUT"
echo "" >> "$OUT"

echo "=== ALL TESTS COMPLETE ===" >> "$OUT"
