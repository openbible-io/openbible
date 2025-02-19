# model

Goals:
- indexable down to morpheme
    - support attributes for parsing, lemma, etc.
    - support refs
- human editable
- deserializable in service worker
    - whole Bible filesize < 25MB

## examples

some sketches to start a schema

### translation source

- Flat structure allows easily indexing.
- Explicit word breaks allow splitting down to morphemes.
```json
[
    { "book": "gen" },
    { "chapter": 1 },
    { "p": "minor" },
    { "v": "1" },
    { "text": "בְּרֵאשִׁ֖ית", "lemma": "H7225", "parsing": "Prep-b | N-fs" },
    " ",
    { "text": "־פְּנֵ֣י", "lemma": "H5921" },
    { "text": "עַל", "lemma": "H6440" }
]
```

### translation

- Same as translation source.

```json
[
    { "book": "gen" },
    { "h1": "Genesis" },
    { "chapter": 1 },
    { "h2": "Chapter 1" },
    { "p": "" },
    { "v": "1" },
    { "text": "In the beginning", "ref": 4 },
    " ",
    { "text": "was over the surface", "ref": { "from": 6, "to": 7 } }
]
````

### notes

- Grandchildren are a subset of HTML for a WYSIWYG editor.
- Refs may have character offsets.
```json
{
    "title": "Quiet time",
    "categories": ["a","b","c"],
    "created": "2025-02-11",
    "updated": "2025-02-11",
    "tags": {
        "verb": { "background-color": "pink" },
        "noun": { "text-decoration": "underline" },
    },
    "notes": {
        "bsb": [
            { "ref": 2, "tag": "verb" },
            { "ref": 4, "tag": "verb",  "children": "Note in HTML subset." },
            {
                "ref": { "from": 5, "fromOffset": 2, "to": 6 },
                "tag": "verb"
            }
        ]
    }
}
```

### commentary

- ???
