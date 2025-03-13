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

## Walkthrough

Suppose site A types "1" while B types "23". How does A merge B's changes?

### OpLogs
The oplogs look like this:
#### A
┌───┬─────┬──────────┬─────────┬──────┬───────┬─────────┐
│   │ pos │ delCount │ content │ site │ clock │ parents │
├───┼─────┼──────────┼─────────┼──────┼───────┼─────────┤
│ 0 │ 0   │ 0        │ 1       │ a    │ 0     │ []      │
└───┴─────┴──────────┴─────────┴──────┴───────┴─────────┘
#### B
┌───┬─────┬──────────┬─────────┬──────┬───────┬─────────┐
│   │ pos │ delCount │ content │ site │ clock │ parents │
├───┼─────┼──────────┼─────────┼──────┼───────┼─────────┤
│ 0 │ 0   │ 0        │ 2       │ b    │ 0     │ []      │
│ 1 │ 1   │ 0        │ 3       │ b    │ 1     │ [ 0 ]   │
└───┴─────┴──────────┴─────────┴──────┴───────┴─────────┘

To save space, B could be run length encoded like this:
┌───────┬─────┬──────────┬─────────┬──────┬───────┐
│ range │ pos │ delCount │ content │ site │ clock │
├───────┼─────┼──────────┼─────────┼──────┼───────┤
│ 0-1   │ 0   │ 0        │ 23      │ b    │ 0     │
└───────┴─────┴──────────┴─────────┴──────┴───────┘
┌───────┬─────────┐
│ range │ parents │
├───────┼─────────┤
│ 0-1   │ []      │
└───────┴─────────┘

...but we'll ignore that for the rest of this walkthrough.


#### 1. Merging

Our first order of business is to merge B's operations into A. That means
appending every change A doesn't have. We can know which ones A doesn't have
via a State Vector:
```ts
{ A: 1 }
```

The only tricky part is each new op's parents which need to be reparented to
A's indexes. While "2"'s parent is [ 0 ] in B's oplog, it will be [ 1 ] in A's
oplog.

┌───┬─────┬──────────┬─────────┬──────┬───────┬─────────┐
│   │ pos │ delCount │ content │ site │ clock │ parents │
├───┼─────┼──────────┼─────────┼──────┼───────┼─────────┤
│ 0 │ 0   │ 0        │ 1       │ a    │ 0     │ []      │
│ 1 │ 0   │ 0        │ 2       │ b    │ 0     │ []      │
│ 2 │ 1   │ 0        │ 3       │ b    │ 1     │ [ 1 ]   │
└───┴─────┴──────────┴─────────┴──────┴───────┴─────────┘

Or, encoded as:
┌───────┬─────┬──────────┬─────────┬──────┬───────┐
│ range │ pos │ delCount │ content │ site │ clock │
├───────┼─────┼──────────┼─────────┼──────┼───────┤
│ 0-0   │ 0   │ 0        │ 1       │ a    │ 0     │
├───────┼─────┼──────────┼─────────┼──────┼───────┤
│ 1-2   │ 0   │ 0        │ 23      │ b    │ 0     │
└───────┴─────┴──────────┴─────────┴──────┴───────┘
┌───────┬─────────┐
│ range │ parents │
├───────┼─────────┤
│ 0-0   │ []      │
├───────┼─────────┤
│ 1-1   │ []      │
└───────┴─────────┘


#### 2. Checking out changes

Now we want to apply those operations from B so that they minimally interleave.
That means we do not want to see "213". First we need to diff the old frontier
[ 0 ] with the merge frontier [ 0, 2 ]:
```ts
{
  head: [],
  shared: [ 0 ],
  bOnly: [ 1, 2 ],
}
```

This tells that this changeset starts at [] (aka the root), [ 0 ] will be
shared between them, and [ 1, 2 ] need to be applied.

##### 2.1 Placeholders

idk

##### 2.2 Apply the operations

We apply the shared operations followed by B's operations. This leaves us
with "123".

diff2 [ 0 ] [ 0, 2 ]
{
  head: [],
  shared: [ 0 ],
  bOnly: [ 1, 2 ],
}
doOp 0
{
  aOnly: [],
  bOnly: [],
}
doOp 1
{
  aOnly: [ 0 ],
  bOnly: [],
}
doOp 2
{
  aOnly: [],
  bOnly: [],
}
