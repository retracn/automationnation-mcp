# stdio by default; add --http to serve Streamable HTTP on port 8080.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY src ./src
ENV NODE_ENV=production
EXPOSE 8080
ENTRYPOINT ["node", "src/index.js"]
