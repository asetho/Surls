'use strict';

// Keep transitive require('braces') compatible while GHSA-vfj7-8cjw-p6xm has no upstream fix.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- micromatch loads this adapter synchronously via CommonJS.
module.exports = require('@dieub/braces-depth-guard');
