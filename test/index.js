const extract = require('../');
const path = require('path');
const fs = require('fs');

const catsZip = path.join(__dirname, 'cats.zip');
const catsOut = path.join(__dirname, 'cats');

try {
    fs.rmSync(catsOut, { recursive: true });
} catch (e) {}

extract(catsZip, { dir: catsOut });