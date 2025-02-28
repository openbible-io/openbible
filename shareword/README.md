# shareword

Model documents using a log of mutations.

Inspired by [Collaborative Text Editing with Eg-walker: Better, Faster,
Smaller](https://arxiv.org/abs/2409.14252)
by
[Joseph Gentle](https://github.com/josephg)
and
[Martin Kleppmann](https://github.com/ept).

## Pros
- Preserve entire document history with granular timestamps
- Flexible merging
    - FugueMax is good for online sessions
    - Manual review is good for offline sessions
- [Peritext compatibility](https://www.inkandswitch.com/peritext/) 
  usually preserves user intent
    - You decide how marks expand (but there are still
    [tricky](https://github.com/inkandswitch/peritext/issues/31)
    [parts](https://github.com/inkandswitch/peritext/issues/32))
- Fast `O(1)` inserts
- Optimized for both left-to-right and right-to-left languages

## Cons
- Slow initial load
    - Must replay history to create in-order document
    - Can be mitigated by snapshots which require more storage
- Merging can be slow
    - Normal case fastest algorithm (see
[benchmark results](./bench/RESULTS.md))
    - Worst case`O(n^2 log(n))` for `n` conflicting operations
- Complicated
    - Causal graph of mutations
    - Document state
    - Internal state to apply mutations to a document state
    - ...and auxilary structures to go fast

## Data types
Data types are composable containers that can build tree-like documents.

### List
Lists support merging splice operations.

- `splice(pos: number, delCount: number, ...items: T[])`

### Text
Specialized list of UTF16 code units that supports marking.

- `new Text({ [mark: string]: "none" | "before" | "after" | "both" })`
- `splice(pos: number, delCount: number, text: string)`
- `mark(pos: number, len: number, key: string, val: any)`

### Map
Maps support last-writer-wins semantics.

- `insert(key: string, val: T)`
- `delete(key: string)`

## Usage
TODO

## Why write another library?
The current best JS CRDT library ([YJS](https://yjs.dev)) does not preserve
delete history and could be simpler, faster, and have better Typescript typings.
