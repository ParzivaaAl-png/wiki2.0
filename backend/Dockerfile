FROM node:20-alpine

# Install curl and glibc compatibility for Meilisearch binary
RUN apk add --no-cache curl libc6-compat

WORKDIR /app

# Download Meilisearch binary
RUN curl -L https://install.meilisearch.com | sh

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Ensure startup script is executable
RUN chmod +x start.sh

EXPOSE 5000

# Start both services
CMD ["./start.sh"]
