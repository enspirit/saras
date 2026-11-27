# saras. One file for development and for production, so that the development
# image is not a different thing that happens to work.
#
# Built from the root of the repository, which .dockerignore narrows to this directory and
# to the specification of the operations, whose types the server checks its inputs against
# (decision 0021):
#
#   docker build -f software/saras/Dockerfile --target saras-production -t saras/saras .
#
# `emb` does this; the target is chosen in Embfile.yml.
#
#   saras-development   every dependency, the tests, a watcher as command
#   saras-production    runtime dependencies only, the bundles built once
#
# The last stage is the production one: a build that names no target ships.

# --- base: the toolchain, and nothing of ours --------------------------------
FROM node:22-bookworm-slim AS base
WORKDIR /app

# --- dependencies: manifests first, so a source change does not reinstall ----
FROM base AS dependencies
COPY software/saras/package.json software/saras/package-lock.json ./
RUN npm ci

# --- sources -----------------------------------------------------------------
FROM dependencies AS sources
COPY software/saras/tsconfig.base.json software/saras/tsconfig.json software/saras/tsconfig.web.json ./
COPY software/saras/scripts ./scripts
COPY software/saras/shared ./shared
COPY software/saras/src ./src
COPY software/saras/web ./web
COPY software/saras/public ./public
COPY software/saras/brands ./brands
COPY software/saras/test ./test
COPY tests/operations/specification ./specification

# --- build: bundle what the browser loads (web/, shared/, the style sheets and
# the translations -> public/js/), once ---------------------------------------
FROM sources AS build
RUN npm run build

# --- saras-development -------------------------------------------------------
# Starts from the built bundles: the server refuses to start without them, and
# the watcher then keeps them up to date.
FROM build AS saras-development
ENV NODE_ENV=development
EXPOSE 3000
CMD ["npm", "run", "dev"]

# --- saras-production: Node runs the TypeScript server directly, so no -------
# compiler is shipped
FROM base AS saras-production
ENV NODE_ENV=production
COPY software/saras/package.json software/saras/package-lock.json ./
RUN npm ci --omit=dev
COPY software/saras/src ./src
COPY software/saras/shared ./shared
COPY software/saras/public ./public
COPY tests/operations/specification ./specification
COPY --from=build /app/public/js ./public/js
# Only used by the embedded database, when no DATABASE_URL is given.
ENV DATA_DIR=/data
RUN mkdir /data && chown node:node /data
VOLUME /data
EXPOSE 3000

# Stated rather than assumed: a base image changing its default user is not
# something anyone notices.
USER node

# What visitors are told is read from the database: an answer means the server
# is up and reaches it. A process whose ROLES leave `web` out answers nothing:
# it is healthy for as long as it runs.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD ["node", "-e", "const r=process.env.ROLES;if(r&&!r.split(',').map(s=>s.trim()).includes('web'))process.exit(0);fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/public').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "src/main.ts"]
