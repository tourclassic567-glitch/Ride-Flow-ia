# Ride-Flow IA — Node.js Backend
# Author: LIORVYS GUARDIOLA | Code: 7039
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3001

CMD ["node", "src/index.js"]
