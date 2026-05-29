#!/bin/sh
# Ensure Nginx run directories exist
mkdir -p /run/nginx /var/log/nginx

# Override MEILI_HTTP_ADDR to run internally on 127.0.0.1:7701
export MEILI_HTTP_ADDR="127.0.0.1:7701"

echo "[Entrypoint] Starting Meilisearch on $MEILI_HTTP_ADDR in background..."
/bin/meilisearch "$@" &
MEILI_PID=$!

echo "[Entrypoint] Starting Nginx on 0.0.0.0:7700..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Define cleanup function
cleanup() {
    echo "[Entrypoint] Shutting down processes..."
    kill -TERM "$MEILI_PID" "$NGINX_PID" 2>/dev/null
    wait "$MEILI_PID"
    wait "$NGINX_PID"
    echo "[Entrypoint] Shutdown complete."
}

# Trap termination signals
trap cleanup INT TERM

# Wait for either process to exit
wait -n

# Exit code from the exited process
EXIT_STATUS=$?
echo "[Entrypoint] A service stopped with exit status $EXIT_STATUS. Exiting..."

# Clean up other service
cleanup
exit $EXIT_STATUS
