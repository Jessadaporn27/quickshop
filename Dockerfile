# ---------- Stage 1: Build React frontend ----------
FROM node:18-alpine AS client-build
WORKDIR /app/client

COPY client/package*.json ./
RUN npm install

COPY client/ .
RUN npm run build

# ---------- Stage 2: Install API dependencies ----------
FROM node:18-alpine AS server-build
WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --production

COPY server/ .

# ---------- Stage 3: Runtime image ----------
FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

COPY --from=server-build /app/server ./server
COPY --from=client-build /app/client/build ./client/build

EXPOSE 5000

CMD ["node", "server/server.js"]
