# bench
Benchmarks to compare algorithms and optimizations on prose.

## Generating logs
Generated logs take up less space and can simulate realistic authors.

### Plain text
We control inputs to `splice(pos: number, delCount: number, text: string)`.

I theorize that prose exhibits has the following distribution:
- `text` is between 1 character (fixing a typo) to 100 words (writing a paragraph)
- `pos` should typically be close to the previous `pos` and near the end
- `delCount` should typically be low (0-20% of document)
- Word count should range from 10-100k

We need to tune the inputs to `merge(...docs)`:
- Number of docs should typically be low (1-10)
- Number of merges should typically be high (10+)
- Number of operations before a merge should typically be low (1-5)

Please share real distributions, especially of concurrency! These were
generalized from [editing trace](https://github.com/josephg/editing-traces) statistics.

## Running
Benchmarks are designed to run quickly (<1m) and be comparable to the previous snapshot.
```sh
bun i
bun cli.ts --help
```

## Results
See [RESULTS.md](./RESULTS.md).
