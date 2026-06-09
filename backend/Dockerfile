FROM node:20-alpine

# Install curl to download Meilisearch binary
RUN apk add --no-cache curl

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
