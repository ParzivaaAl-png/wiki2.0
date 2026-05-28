FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV NEXT_PUBLIC_API_URL http://localhost:5000/api
ENV INTERNAL_API_URL http://backend:5000/api

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
