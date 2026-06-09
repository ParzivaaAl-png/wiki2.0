FROM node:20-slim

# Install curl and ca-certificates
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Download Meilisearch binary directly from GitHub releases to bypass rate-limiting
RUN curl -L https://github.com/meilisearch/meilisearch/releases/download/v1.11.0/meilisearch-linux-amd64 -o meilisearch && \
    chmod +x meilisearch

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Ensure startup script is executable
RUN chmod +x start.sh

EXPOSE 5000

# Start both services
CMD ["./start.sh"]
