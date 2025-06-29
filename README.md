# decgbi

### A JS library to decompress CgBI files to PNG.

<a href="https://discord.gg/bMFPpxtMTe"><img src="https://img.shields.io/discord/977286501756968971?color=5865F2&logo=discord&logoColor=white" alt="Discord server" /></a>
<a href="https://www.npmjs.com/package/decgbi"><img src="https://img.shields.io/npm/v/decgbi?maxAge=3600" alt="npm version" /></a>
<a href="https://www.npmjs.com/package/decgbi"><img src="https://img.shields.io/npm/dt/decgbi.svg?maxAge=3600" alt="npm downloads" /></a>

### Documentation live at https://s0n1c.ca/decgbi

## Installation

```zsh
% bun i decgbi
```

## Usage

`decgbi` is available via server-side (Bun & Node.js), as well as in browser.

```ts
import { decgbi } from 'decgbi';

const orig = new Uint8Array(...); // the original CgBI data
const png = decgbi(orig); // the decompressed PNG data, as Uint8Array
```
