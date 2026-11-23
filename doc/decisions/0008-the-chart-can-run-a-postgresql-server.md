# 0008 — The chart can run a PostgreSQL server, in a pod of its own

## Context

The chart ran saras on a PostgreSQL server of the operator's, or on the embedded database to try it ([decision 0007](0007-a-helm-chart-for-operators.md)). An operator whose cluster offers no PostgreSQL was left between a database not meant for real use and installing a server by other means before saras. Decision 0007 turned a server in the chart down, so as not to answer for its upgrades and backups, and named what would bring it back: a database the chart cannot leave to the operator.

## Decision

With `postgresql.enabled`, the release runs one PostgreSQL server beside saras: a StatefulSet of one pod, the image `postgres` at the major version the stack is tested on, a volume of its own, a Service inside the cluster. saras is given its address and waits for it to answer before it starts.

- **Off by default, and one database at a time**: the chart refuses two of a server of the operator's, a server of the release, and the embedded database.
- **Its password is given, never generated**, as `APP_SECRET` is: the server keeps the one its volume was first filled with, and a password Helm made up again at an upgrade would lock saras out. It is given as a value, or as the name of a Secret of the operator's, so that a values file kept in git holds none.
- **saras reads that password where the database reads it.** Its address carries none; the driver takes it from `PGPASSWORD`, set from the same Secret. The chart therefore never needs to know it.
- **One pod, and not a value.** The chart does not replicate the server, back it up, or move it to another major version. Its README says how a dump is taken and that these are the operator's.
- **The volume is kept** when the release is uninstalled.
- **Written here**, in one template: no chart of someone else's is depended on.

## Alternatives

- **Leave it out**, as decision 0007 did. It keeps the chart from answering for a database; it also sends the operator without one to the embedded database, which is the one not to run for real.
- **A dependency on a PostgreSQL chart** (Bitnami's, or an operator such as CloudNativePG). They do what this does not: replicas, backups, upgrades. They are also a second thing to follow and to trust, far larger than saras itself, whose images and licence have changed under their users before.
- **A second container in the pod of saras.** The database would be restarted with every upgrade of saras, and could not be given resources or a volume of its own.
- **A generated password**, kept across upgrades by reading the Secret back from the cluster. `helm template` and the tools built on it cannot read the cluster, and would make a new one each time.

- **The password written into `DATABASE_URL` by the chart.** It must then know the password, which a Secret of the operator's does not let it; and it has to spell it as an address does, where the database wants it as it is.

## Consequences

- The chart now names a second image, pinned to a major version by `postgresql.image.tag`. Another major version does not start on the files of the previous one: nothing here moves them.
- saras leaves when its database goes away, and Kubernetes starts it again: a restart of the database pod is half a minute without saras.
- The chart relies on the driver of saras reading `PGPASSWORD`, which the server's configuration does not name: a change of driver is a change here.
- Nothing installs this on a cluster in CI: it is held by what the chart renders, and was installed by hand once.

## What would reverse this

Operators asking of it what it does not do: a replica, a scheduled backup, an upgrade between major versions. The chart then depends on something that does, or goes back to naming a server of the operator's.
