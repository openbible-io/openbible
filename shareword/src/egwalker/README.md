# egwalker

This is an implementation of [Collaborative Text Editing with
Eg-walker: Better, Faster, Smaller](https://arxiv.org/pdf/2409.14252)
by
[Joseph Gentle](https://github.com/josephg)
and
[Martin Kleppmann](https://github.com/ept).

It began as a fork of
[eg-walker-from-scratch](https://github.com/josephg/egwalker-from-scratch).

## Theory

Storing the document as an append-only list of immutable operations
([OpLog](./oplog.ts)) captures the author's intent better than a resulting
text file.

This allows "walking" the list to recreate it at any point in time. With some
additional metadata (a `site` and its `clock`), a [CRDT](./egwalker.ts) can be
implemented which allows for live collaboration.

To avoid having to rewalk this structure, you can traverse the graph through a
[Branch](./branch.ts).
