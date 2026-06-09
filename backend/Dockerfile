FROM node:20-alpine

# Install curl and glibc compatibility for Meilisearch binary
RUN apk add --no-cache curl libc6-compat

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
