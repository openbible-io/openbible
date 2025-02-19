# bsb

[![GitHub license](https://img.shields.io/github/license/openbible-io/bsb?style=for-the-badge)](./LICENSE.md)
[![jsr version](https://img.shields.io/jsr/v/@openbible/bsb.svg?style=for-the-badge)](https://jsr.io/@openbible/bsb)

Source control and normalization for the
[Berean Standard Bible](https://bereanbible.com/).

```ts
import * as bsb from "@openbible/bsb";

console.log(bsb);
// {
//   "title": "Berean Standard Bible",
//   "lang": "eng",
//   "downloadUrl": "https://berean.bible/downloads.htm",
//   "publisher": "BSB Publishing",
//   "publisherUrl": "https://berean.bible",
//   "publishDate": "2022",
//   "isbn": 9781944757045,
//   "license": "CC-PDDC",
//   "licenseUrl": "https://berean.bible/licensing.htm",
//   "authors": [...],
//   "preface": "<p></p>",
//   "toc": {...}
//   "audio": {...},
// }
```

## Continuous Integration

Master is updated daily but won't be published until reviewed.
