# emb — what saras asks of it

[emb](https://github.com/enspirit/emb), installed from npm (`@enspirit/emb`, 0.31.1 when this was written). How an entry is written: [`README.md`](README.md).

## M1 — An image built with named build contexts

**Status**: idea.

**What saras needs.** The image of saras needs `software/saras` and the specification of the operations, `tests/operations/specification`, whose types the server checks its inputs against ([decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)). A `docker/image` resource takes one `context`, so the image is built from the root of the repository, which a root [`.dockerignore`](../../.dockerignore) narrows to those two directories, and every `COPY` of the [Dockerfile](../../software/saras/Dockerfile) names `software/saras/…`. A root `.dockerignore` is read by every build from the root, whatever its image.

**What is asked.** Named build contexts on a `docker/image` resource, as `docker buildx build --build-context name=path` and compose's `additional_contexts` have them:

```yaml
params:
  target: saras-development
  contexts:
    specification: /tests/operations/specification
```

with `COPY --from=specification . ./specification` in the Dockerfile, each context crawled with its own `.dockerignore` and counted by the `watch-paths` rebuild trigger.

**What saras changes once it is there.** The context of the image is `software/saras` again, with its own `.dockerignore`; the root `.dockerignore` goes, and the `COPY` lines lose their prefix.
