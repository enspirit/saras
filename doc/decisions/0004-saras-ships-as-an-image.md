# 0004 — saras ships as an image, and the repository describes no deployment

## Context

saras is self-hosted. Before the repository was laid out as it is, a `docker-compose.yml` at its root built the application and started it with a PostgreSQL server: an operator's `docker compose up`. The layout has a place for what describes where things run, `world/`, and that file was first moved there, as `world/compose`.

A compose file kept for operators is not how we deploy: it is a second description of the stack, beside the one the suites run, that nothing but a lint could hold to it.

## Decision

What ships is the image: the `saras-production` target of `software/saras/Dockerfile`, which CI builds on every push. The repository holds no deployment description. An operator runs the image with the configuration described in `software/saras/env/base.env`, on its embedded database or on a PostgreSQL server of their own, as the README shows; or runs `npm start` from a checkout.

The compose files of the root are the stack saras is developed and tested in, and nothing else.

## Consequences

- Starting saras *and* a PostgreSQL server with one command is no longer something the repository offers (US-84 says so).
- An installation made with the former compose file keeps its data in the volume `saras_saras-postgres`, which nothing here touches.

The image has since been given a registry: [decision 0006](0006-the-image-is-published-on-docker-hub.md). This one stands, as no deployment is described.

## What would reverse this

A registry and somewhere we host saras ourselves: the deployment is then described once, in `world/` (a chart), names a published image, and is held to `.env.commons` by a test.
