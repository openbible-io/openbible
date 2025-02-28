# bsb

[![License](https://img.shields.io/github/license/openbible-io/openbible?style=for-the-badge)](../../LICENSE.md)
[![npm version](https://img.shields.io/npm/v/@openbible/bsb.svg?style=for-the-badge)](https://npmjs.com/package/@openbible/bsb)

Assets for the [Berean Standard Bible](https://bereanbible.com/).

## Building

`bun build/text.ts`

Downloads interlinear books and parses them to the openbible format.
Writes them to `src/generated`.

`bun run build`

Builds TypeScript to `dist`.

`bun build/audio.ts`

Downloads audiobooks and masters them using [FFmpeg](https://www.ffmpeg.org/).

