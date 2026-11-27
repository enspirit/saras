# Upstream — what saras asks of its companion projects

saras is built on open source projects of its own family, each with its repository, its releases and its own judgement on what it takes in. When working on saras shows something one of them lacks, the need is written here first: one file per project, one entry per idea, requirement or issue, ready to be filed there.

| Project | What saras takes of it | File |
| --- | --- | --- |
| [Elo](https://github.com/enspirit/elo) | The expression language of rules, filters and the types of the specification; it checks what an operation is given ([decision 0021](../decisions/0021-an-input-is-refused-when-it-is-not-of-its-type.md)) | [`elo.md`](elo.md) |
| [opspicy](https://github.com/enspirit/opspicy) | What reads and runs the specification of the operations, from its image ([decision 0020](../decisions/0020-opspicy-is-a-project-of-its-own.md)) | [`opspicy.md`](opspicy.md) |
| [emb](https://github.com/enspirit/emb) | The one entry point of the tasks, which builds the images and runs the stack | [`emb.md`](emb.md) |

## An entry

Each entry has an identifier (`E1`, `O1`, `M1`: the project's initial, then a number never reused), and says:

- **Status**: *idea* (to discuss), *to file* (ready), *filed* (with the link to the issue there), *released* (with the version), or *dropped* (with why).
- **What saras needs**, in saras's terms, and where it falls short without it: a gap, a deviation, a workaround in the code, linked.
- **What is asked**: the behaviour wanted from the project, in its own terms, with an example. A proposal of syntax or API is a proposal: the project decides.
- **What saras changes once it is there**: the workaround that goes, the gap that closes.

An entry is filed by copying its text into an issue of the project, and its status says so. Once the version that answers it is taken here, the workaround goes in the same change, and the entry is *released*. An entry stays in its file, whatever its status: the identifier is what other documents link to.
