#!/bin/sh

# Start Meilisearch in the background, bound to localhost (127.0.0.1)
echo "=== Starting Meilisearch on 127.0.0.1:7700 ==="
./meilisearch --http-addr "127.0.0.1:7700" --master-key "${MEILI_MASTER_KEY:-masterKey}" &

# Wait for Meilisearch to start up
echo "Waiting for Meilisearch..."
sleep 4

# Start the Node.js application
echo "=== Starting Node.js backend ==="
npm start
