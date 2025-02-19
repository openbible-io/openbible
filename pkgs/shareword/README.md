# shareword

Share rich text documents with peers.

## Algorithm
Core text algorithm is
[Collaborative Text Editing with Eg-walker: Better, Faster, Smaller](https://arxiv.org/abs/2409.14252)
by Joseph Gentle and Martin Kleppmann.

This has been extended to handle rich text and the primitives have been shared
to enable generic list and map types.

## Why another implementation?

There exist good [CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)
implementations, but I have issues with each of them:
- [YJS](https://yjs.dev)
    - Not written in Typescript
    - Not [Peritext compatible](https://www.inkandswitch.com/peritext/)
    - Loses delete history
- [Automerge](https://automerge.org/)
    - Large code size [(2.4MB, 880kB gzipped)](https://bundlejs.com/?q=%40automerge%2Fautomerge%40v2.2.8&treeshake=%5B%7B+next+as+A+%7D%5D)
    - No event graph
    - Backwards interleaving issues
- [Diamond types](https://github.com/josephg/diamond-types/)
    - Not Peritext compatible
    - Only text
- [Loro](https://loro.dev)
    - Large code size [(3.1MB, 967kB gzipped)](https://bundlejs.com/?q=loro-crdt%401.4.2&treeshake=%5B*%5D)
    - Trades 2x document size for faster loading times

I also want some new novel features:
- Multiple selections
- Tight HTML editor integration
    - No storing document twice in memory
    - Custom components for view

And finally, I want to understand them for maintainence purposes.
And they're fun.
