# 0007 — The repository ships a Helm chart, for operators

## Context

saras ships as an image and the repository describes no deployment ([decision 0004](0004-saras-ships-as-an-image.md)); the image is on Docker Hub ([decision 0006](0006-the-image-is-published-on-docker-hub.md)). An operator on Kubernetes then writes the same few objects each time, and has to find out alone what the image does not say: that it must run as one replica, which of its variables are secrets, what tells that it is ready.

## Decision

[`world/chart`](../../world/chart/) is a Helm chart for whoever hosts saras on Kubernetes. It names the published image and describes no installation: no cluster, no address, no secret, no values file of an environment.

- **One replica, and not a value.** The server fetches the mailboxes on a timer of its own, and the embedded database takes one connection.
- **The database is the operator's**: a PostgreSQL server named by `DATABASE_URL`. To try saras, the embedded database on a volume, chosen explicitly; the chart refuses to install with neither.
- **The server's variables are not described a second time.** `secrets` takes those that are secrets, `config` the others, by the names of `software/saras/env/base.env`; a test holds the chart to that file.
- **`APP_SECRET` is given, never generated**: a key Helm made up is a key the operator does not have the day the release is lost.
- **It is not published.** It is installed from a checkout, until it has been installed for real.

Decision 0004 stands: the compose files remain the stack saras is developed and tested in, and no deployment is described. What it no longer says is that an operator gets nothing but the image.

The chart has since been given a PostgreSQL server it runs when asked: [decision 0008](0008-the-chart-can-run-a-postgresql-server.md). The rest stands.

## Alternatives

- **No chart**, as before: the README's `docker run` is enough on one machine, and says nothing to an operator on a cluster.
- **A PostgreSQL server in the chart** (a StatefulSet, or a dependency on a chart of someone else's). One command would start everything; the chart would then answer for a database's upgrades and backups, which is what decision 0004 dropped with the operator's compose file.
- **The embedded database whenever no server is named.** The chart cannot read a Secret of the operator's, so it cannot tell; and a trial database nobody chose is one somebody runs for real.
- **Plain manifests, or Kustomize.** Nothing in them refuses a second replica or a secret in a ConfigMap before it reaches the cluster.

## Consequences

- `emb run lint` and `emb run test` need `helm` on the machine. GitHub's runners have it.
- Nothing installs the chart on a cluster: what is held is what it renders.
- The chart follows the image by hand: a new secret, a new port or a new path for the health check is a change here too.

## What would reverse this

A second replica becoming possible (the timers moved out of the server, or made to agree): `replicas` becomes a value, and upgrades stop interrupting. It has: [decision 0010](0010-the-server-migrates-its-database-and-several-may-share-it.md). Or a database the chart cannot leave to the operator: it then answers for one, and says how it is upgraded and backed up.
