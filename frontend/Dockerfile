# Ride-Flow IA — React Frontend
# Author: LIORVYS GUARDIOLA | Code: 7039

# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG REACT_APP_API_URL=/api
ARG REACT_APP_WS_URL=wss://204.168.234.151/ws
ENV REACT_APP_API_URL=$REACT_APP_API_URL \
    REACT_APP_WS_URL=$REACT_APP_WS_URL

RUN npm run build

# ── Serve stage ─────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx-fe.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
