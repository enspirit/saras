# 0006 — The image is published on Docker Hub, by CI

## Context

saras ships as an image ([decision 0004](0004-saras-ships-as-an-image.md)), which CI builds on every push and then throws away: an operator had to build it from a checkout. Someone who wants to run saras should not need its sources, nor a machine of the architecture they deploy on.

## Decision

CI publishes the `saras-production` image as [`enspirit/saras`](https://hub.docker.com/r/enspirit/saras) on Docker Hub, for amd64 and arm64, once the suites are green:

| From | Tags |
| --- | --- |
| `main` | `latest`, `sha-<commit>` |
| a tag `v1.2.3` | `1.2.3`, `1.2` |
| a tag `v1.2.3-rc.1` | `1.2.3-rc.1` only |

Nothing is published from a pull request or from another branch. Publishing is a task like the others, `emb run publish` (`bin/publish`): CI gives the runner a builder and a login, then calls it. `PUBLISH_DRY_RUN=1` prints what it would build.

The login is two secrets of the GitHub repository, `DOCKER_HUB_USERNAME` and `DOCKER_HUB_ACCESS_TOKEN`: the only ones CI reads, in the only job a pull request cannot reach.

## Alternatives

- **`emb resources publish`**, which is what `publish: true` in an Embfile is for. As of emb 0.31 it names an image `<project>/<component>` under the registry, which gives `enspirit/saras/saras`, a name Docker Hub has no place for; and it pushes one tag, of an image built for one architecture.
- **The build written in the workflow**, with `docker/build-push-action`. It is what was first merged; it is a command that exists nowhere but in CI, which the workflow otherwise refuses.
- **GitHub's registry** (`ghcr.io`), which needs no secret. Docker Hub is where an operator looks first.

## Consequences

- `latest` is whatever `main` last was, tested but not released. An operator who wants to choose when they upgrade pins a version tag.
- Each publication builds the arm64 image under emulation, bundles included, with no cache between runs. It happens on `main` and on version tags only.
- A release is a tag `v1.2.3` pushed to GitHub. Nothing else is needed, and nothing yet says what a release promises.

## What would reverse this

`emb` naming an image freely and pushing a multi-architecture manifest: the task then becomes `emb resources publish --flavor production`. Or a registry of our own, beside somewhere we host saras ourselves, which is also what would reverse decision 0004.
