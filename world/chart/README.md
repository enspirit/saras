# chart

**saras on Kubernetes, for an operator.** A Helm chart that runs the published image, [`enspirit/saras`](https://hub.docker.com/r/enspirit/saras), on a PostgreSQL server the operator has, on one the release runs in a pod of its own, or on the embedded database to try it. It describes no installation: no cluster, no address, no secret ([decision 0007](../../doc/decisions/0007-a-helm-chart-for-operators.md)).

## Public interface

From a checkout, with Helm 3 or 4. For real use, on a PostgreSQL server, behind an ingress:

```sh
helm install saras world/chart \
  --set-string secrets.APP_SECRET="$(openssl rand -hex 32)" \
  --set-string secrets.DATABASE_URL=postgres://user:password@host:5432/saras \
  --set ingress.enabled=true --set ingress.host=saras.example.org --set ingress.tlsSecret=saras-tls
```

With a PostgreSQL server of the release's own, when the cluster has none to offer:

```sh
helm install saras world/chart \
  --set-string secrets.APP_SECRET="$(openssl rand -hex 32)" \
  --set postgresql.enabled=true --set-string postgresql.password="$(openssl rand -hex 16)"
```

To try it, on the embedded database, reached with `kubectl port-forward` (the notes printed by the install give the command):

```sh
helm install saras world/chart \
  --set-string secrets.APP_SECRET="$(openssl rand -hex 32)" \
  --set embeddedDatabase.enabled=true
```

No secret has to be written in the values, or in a file of yours that is committed: each may be in a Secret you create first, which the chart is only told the name of.

```sh
kubectl create secret generic saras-secrets --from-literal=APP_SECRET="$(openssl rand -hex 32)"
kubectl create secret generic saras-database --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)"
helm install saras world/chart \
  --set existingSecret=saras-secrets \
  --set postgresql.enabled=true --set postgresql.existingSecret=saras-database
```

Keep the `APP_SECRET` you generated: an upgrade must be given the same one, and without it connected mailboxes are unreadable. Keep the password of the database too: the server keeps the one its volume was first filled with, whatever an upgrade says.

The values, each described in [`values.yaml`](values.yaml):

| Value | Says |
| --- | --- |
| `secrets.<NAME>` | A secret the server reads: `APP_SECRET`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `SMTP_URL`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET`. Kept in a Secret the chart creates. |
| `existingSecret` | A Secret of the operator's holding those names, for values that must not pass through Helm. It wins over `secrets`. |
| `config.<NAME>` | Any other variable of [`software/saras/env/base.env`](../../software/saras/env/base.env), where each is described with its default. |
| `replicas` | How many pods of saras, on one PostgreSQL server: 1 unless said. Each takes every role of the server; with more than one, an upgrade replaces them one after the other. |
| `baseUrl` | The public address. Empty: where the ingress answers, in https when it has a certificate. |
| `postgresql.*` | A PostgreSQL server of the release: one pod (`<release>-postgresql-0`), one volume, reached by saras alone. Its password is required: as `password`, or in a Secret of the operator's, `existingSecret`, under `existingSecretKey` (`POSTGRES_PASSWORD` unless said). |
| `embeddedDatabase.*` | The embedded database instead of a server, on a volume the chart claims, or on a claim of the operator's. |
| `brand.configMap` | A ConfigMap holding the files of a [brand folder](../../doc/4-design.md#7-brands). |
| `image.*`, `service.*`, `ingress.*`, `resources`, `podAnnotations`, `nodeSelector`, `tolerations`, `affinity` | What they say in any chart. `image.tag` empty is `latest`: pin a version to choose when you upgrade. |

It refuses to install, and says why: without a master key of 32 characters, without a database or with two, with several replicas on the embedded database, with a database of its own and no password for it or two, with a secret given as `config`, with a value it does not know.

## Depends on

- The image, as published ([decision 0006](../../doc/decisions/0006-the-image-is-published-on-docker-hub.md)), **no older than the one that migrates its database** when `replicas` is more than 1: an earlier one runs its timers in every pod. It listens on 3000, runs as the user `node` (1000), keeps the embedded database in `/data`, writes nowhere else but `/tmp`, and answers `GET /api/public` once it reaches its database. It says what it does on its standard output, one JSON object per line (`kubectl logs`), as much as `config.LOG_LEVEL` asks for, and never a secret or a mail ([decision 0012](../../doc/decisions/0012-the-server-logs-json-lines-and-never-what-it-protects.md)). Its PostgreSQL driver takes the password from `PGPASSWORD` when `DATABASE_URL` carries none: how saras reads the password of the release's server from the Secret that holds it.
- [`software/saras/env/base.env`](../../software/saras/env/base.env), for the names of the variables.
- The image [`postgres`](https://hub.docker.com/_/postgres), version 16 as in the stack, when the release runs its own server: its user `postgres` (999), `pg_isready`, and a data folder it fills once from `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB`.
- In the cluster: a PostgreSQL server unless the chart is asked for a database, a default storage class when it is, and an ingress controller to be reached from outside.

## Must not

1. **Run two replicas on the embedded database**, which one process opens: it refuses to. On a PostgreSQL server `replicas` is the operator's: the servers agree in the database on who migrates it, who fetches a mailbox and who sends a reply ([decision 0010](../../doc/decisions/0010-the-server-migrates-its-database-and-several-may-share-it.md)). Nor does it share the roles of the server out between pods: every pod takes them all, and `config.ROLES` is refused.
2. **Put a secret anywhere but a Secret**: `config` refuses the names `secrets` takes.
3. **Ask for a secret in the values.** Whatever is secret can be given as the name of a Secret of the operator's instead (`existingSecret`, `postgresql.existingSecret`), so that a values file kept in git holds none. A value added to the chart that is a secret comes with that way in.
4. **Make a guarantee a setting**: it passes the server its variables, and has none of its own that loosens what the server holds (zero retention, TLS towards mail servers, sealing).
5. **Run a database server nobody asked for**: `postgresql.enabled` is false until the operator says otherwise, and no chart of someone else's is pulled in.
6. **Answer for more than one PostgreSQL pod on one volume.** It does not replicate the server, back it up, or move it to another major version: these are the operator's. A dump is `kubectl exec <release>-postgresql-0 -- pg_dump -U saras saras`; another major version of `postgresql.image.tag` does not start on the files of the previous one, and is reached by a dump and a new volume.
7. **Open the database to anything but saras**: its Service is inside the cluster, and its password is in a Secret.
8. **Delete a database**: the claims it creates, for the embedded one and for the server, are kept when the release is uninstalled.
9. **Describe an installation**: it names no cluster, no address and no secret, and has no values file of an environment.

## Harness

```sh
emb run chart:lint   # helm lint, strictly; part of `emb run lint`
emb run chart:test   # what it renders and what it refuses; part of `emb run test`
```

Both need `helm` on the machine and no cluster. [`chart.test.ts`](chart.test.ts) holds the chart to `env/base.env`: every variable described there is taken by `secrets`, set by the chart, or accepted by `config`, and the test names which.

## Status

> **In flight:** nothing.

- **No suite installs it.** What is held is what `helm template` renders. It was installed by hand once, on Docker Desktop's Kubernetes (1.34). On the embedded database: the pod became ready, an organisation survived two upgrades, a value of `config` reached the server, and the claim was kept at uninstall. On a PostgreSQL server of the operator's: the pod became ready and created its schema there (before it had migrations). With a server of the release: saras waited for it and started without a restart, an organisation survived an upgrade and a restart of the database pod, and the claim was kept at uninstall; and again with every secret in Secrets made beforehand, the values holding none. It has not been installed behind an ingress, nor with a brand.
- **Several replicas were never installed on a cluster.** That the Deployment asks for them, and replaces them one after the other, is what `helm template` renders; that several servers agree on one database is held by the tests of `software/saras`, which start two.
- **saras stops when its database goes away**, whoever runs it, and Kubernetes starts it again: after the database pod was restarted it was back in half a minute, having been restarted twice. That is the server's, not the chart's.
- It is not published: it is installed from a checkout.
- A new secret variable of the server is a name to add to `templates/_helpers.tpl`; until then `config` would take it. The test fails only for a name the chart knows and `env/base.env` no longer describes.
