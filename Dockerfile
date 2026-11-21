# Compile the browser code (web/ -> public/js/).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.base.json tsconfig.web.json ./
COPY web ./web
COPY scripts ./scripts
RUN npm run build

# Runtime: Node runs the TypeScript server directly, so no compiler is shipped.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
COPY --from=build /app/public/js ./public/js
# Only used by the embedded database, when no DATABASE_URL is given.
ENV DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "src/main.ts"]
