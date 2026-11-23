# chart

**saras on Kubernetes, for an operator.** A Helm chart that runs the published image, [`enspirit/saras`](https://hub.docker.com/r/enspirit/saras), on a PostgreSQL server the operator has, or on the embedded database to try it. It describes no installation: no cluster, no address, no secret ([decision 0007](../../doc/decisions/0007-a-helm-chart-for-operators.md)).

## Public interface

From a checkout, with Helm 3 or 4. For real use, on a PostgreSQL server, behind an ingress:

```sh
helm install saras world/chart \
  --set-string secrets.APP_SECRET="$(openssl rand -hex 32)" \
  --set-string secrets.DATABASE_URL=postgres://user:password@host:5432/saras \
  --set ingress.enabled=true --set ingress.host=saras.example.org --set ingress.tlsSecret=saras-tls
```

To try it, on the embedded database, reached with `kubectl port-forward` (the notes printed by the install give the command):

```sh
helm install saras world/chart \
  --set-string secrets.APP_SECRET="$(openssl rand -hex 32)" \
  --set embeddedDatabase.enabled=true
```

Keep the `APP_SECRET` you generated: an upgrade must be given the same one, and without it connected mailboxes are unreadable.

The values, each described in [`values.yaml`](values.yaml):

| Value | Says |
| --- | --- |
| `secrets.<NAME>` | A secret the server reads: `APP_SECRET`, `DATABASE_URL`, `OPENROUTER_API_KEY`, `SMTP_URL`, `GOOGLE_CLIENT_SECRET`, `MICROSOFT_CLIENT_SECRET`. Kept in a Secret the chart creates. |
| `existingSecret` | A Secret of the operator's holding those names, for values that must not pass through Helm. It wins over `secrets`. |
| `config.<NAME>` | Any other variable of [`software/saras/env/base.env`](../../software/saras/env/base.env), where each is described with its default. |
| `baseUrl` | The public address. Empty: where the ingress answers, in https when it has a certificate. |
| `embeddedDatabase.*` | The embedded database instead of a server, on a volume the chart claims, or on a claim of the operator's. |
| `brand.configMap` | A ConfigMap holding the files of a [brand folder](../../doc/4-design.md#7-brands). |
| `image.*`, `service.*`, `ingress.*`, `resources`, `podAnnotations`, `nodeSelector`, `tolerations`, `affinity` | What they say in any chart. `image.tag` empty is `latest`: pin a version to choose when you upgrade. |

It refuses to install, and says why: without a master key of 32 characters, without a database or with two, with a secret given as `config`, with a value it does not know.

## Depends on

- The image, as published ([decision 0006](../../doc/decisions/0006-the-image-is-published-on-docker-hub.md)): it listens on 3000, runs as the user `node` (1000), keeps the embedded database in `/data`, writes nowhere else but `/tmp`, and answers `GET /api/public` once it reaches its database.
- [`software/saras/env/base.env`](../../software/saras/env/base.env), for the names of the variables.
- In the cluster: a PostgreSQL server unless the embedded database is chosen, and an ingress controller to be reached from outside.

## Must not

1. **Run two replicas.** The server fetches the mailboxes on a timer of its own, and the embedded database takes one connection: `replicas` is not a value, and an upgrade stops the old pod before it starts the new one.
2. **Put a secret anywhere but a Secret**: `config` refuses the names `secrets` takes.
3. **Make a guarantee a setting**: it passes the server its variables, and has none of its own that loosens what the server holds (zero retention, TLS towards mail servers, sealing).
4. **Run a database server.** Its upgrades and its backups are the operator's, with the tools they already have.
5. **Delete the embedded database**: the claim it creates is kept when the release is uninstalled.
6. **Describe an installation**: it names no cluster, no address and no secret, and has no values file of an environment.

## Harness

```sh
emb run chart:lint   # helm lint, strictly; part of `emb run lint`
emb run chart:test   # what it renders and what it refuses; part of `emb run test`
```

Both need `helm` on the machine and no cluster. [`chart.test.ts`](chart.test.ts) holds the chart to `env/base.env`: every variable described there is taken by `secrets`, set by the chart, or accepted by `config`, and the test names which.

## Status

> **In flight:** nothing.

- **No suite installs it.** What is held is what `helm template` renders. It was installed by hand once, on Docker Desktop's Kubernetes (1.34). On the embedded database: the pod became ready, an organisation survived two upgrades, a value of `config` reached the server, and the claim was kept at uninstall. On a PostgreSQL server: the pod became ready and created its schema there. It has not been installed behind an ingress, nor with `existingSecret` or a brand.
- It is not published: it is installed from a checkout.
- A new secret variable of the server is a name to add to `templates/_helpers.tpl`; until then `config` would take it. The test fails only for a name the chart knows and `env/base.env` no longer describes.
