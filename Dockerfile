# Bundle what the browser loads (web/, shared/, the style sheets and the translations -> public/js/).
# The bundle is the same for every platform: built once, on the machine's own architecture.
FROM --platform=$BUILDPLATFORM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
COPY shared ./shared
COPY scripts ./scripts
COPY public ./public
RUN npm run build

# Runtime: Node runs the TypeScript server directly, so no compiler is shipped.
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY shared ./shared
COPY public ./public
COPY --from=build /app/public/js ./public/js
# Only used by the embedded database, when no DATABASE_URL is given.
ENV DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000
USER node
CMD ["node", "src/main.ts"]
