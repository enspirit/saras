# compose

saras as an operator runs it with Docker: the application and a PostgreSQL server, described by one compose file. It is responsible for one thing: that `docker compose up -d`, from this directory, gives a working installation.

```sh
cd world/compose
cp ../../software/saras/.env.example .env   # then set APP_SECRET, OPENROUTER_API_KEY and POSTGRES_PASSWORD
docker compose up -d
```

## Public interface

- **`docker-compose.yml`**, run from this directory. It builds the production image from [`software/saras`](../../software/saras/), starts it with a PostgreSQL server, and publishes saras on `127.0.0.1:3000`: put an HTTPS reverse proxy in front, and set `BASE_URL`.
- **`.env`**, beside it and not committed: the variables of [`software/saras/.env.example`](../../software/saras/.env.example). `POSTGRES_PASSWORD` is required; `DATABASE_URL` is composed from it.
- **The project is named `saras`**, and the database is the volume `saras_saras-postgres`.
- **A brand**: mount its folder and set `BRAND_DIR`, as the comment in the file shows.

## Depends on

| | |
| --- | --- |
| [`software/saras`](../../software/saras/) | Its Dockerfile's `saras-production` target, and its configuration. |
| `postgres:16` | The same image the stack of [`docker-compose.base.yml`](../../docker-compose.base.yml) is tested on. |

## Must not

1. **Run a PostgreSQL the suites do not run on**: the image named here is the one of `docker-compose.base.yml`.
2. **Default a secret**: `POSTGRES_PASSWORD` has no default, and `APP_SECRET` comes from `.env` only.
3. **Share anything with the development stack**: that one is the project `saras-dev`.

## Harness

```sh
emb run compose:lint
```

Green means: docker compose accepts the file, and rule 1 holds ([`lint`](lint)). That the image it builds exists is checked by CI, which builds the production target.

## Status

> **In flight:** nothing.

The image is built from the checkout, not pulled: see [the decision](../../doc/decisions/0004-an-operator-builds-from-a-checkout.md). Nothing starts the deployment in CI.
