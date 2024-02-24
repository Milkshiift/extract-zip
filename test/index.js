const extract = require('../');
const path = require('path');
const fs = require('fs');

const catsZip = path.join(__dirname, 'cats.zip');
const catsOut = path.join(__dirname, 'cats');

function deleteCats() {
    try {
        fs.rmSync(catsOut, { recursive: true });
    } catch (e) {}
}

function testFileExtract() {
    deleteCats()
    extract.extractFile(catsZip, { dir: catsOut });
}

function testBufferExtract() {
    const catsBuf = fs.readFileSync(catsZip)
    deleteCats()
    extract.extractBuffer(catsBuf, { dir: catsOut });
}

testFileExtract()
testBufferExtract()
