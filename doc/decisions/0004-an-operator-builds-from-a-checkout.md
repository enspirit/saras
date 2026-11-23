# 0004 — An operator builds the image from a checkout

## Context

saras is self-hosted. "Deploy simply" (US-84) is `docker compose up` with a PostgreSQL server. Describing a deployment usually means naming a published image; saras has no registry.

## Decision

The deployment is `world/compose/docker-compose.yml`, run from that directory, which builds the production target of `software/saras/Dockerfile` from the checkout it is in. It is the one compose file with a `build:` key: the stack of the repository's root names its images and lets `emb` build them, and an operator has no `emb`.

Its project is named `saras` whatever the directory is called, so that the volume holding the database keeps its name; the development stack is `saras-dev`, and the two share nothing.

## What holds it to the rest

`emb run lint` checks that the file is one docker compose accepts and that it runs the PostgreSQL image the suites run on; CI builds the production target (`emb resources build --flavor production`).

## What would reverse this

A registry. The file then names `saras/saras:<version>`, the `build:` key goes, CI publishes with `emb resources publish --flavor production`, and an operator needs the two files of `world/compose` rather than a checkout.
