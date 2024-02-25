const extract = require('../');
const path = require('path');
const fs = require('fs');

const catsZip = path.join(__dirname, 'cats.zip');
const catsOut = path.join(__dirname, 'cats');

async function deleteCats() {
    try {
        await fs.promises.rm(catsOut, { recursive: true });
    } catch (e) {}
}

async function testFileExtract() {
    await deleteCats()
    await extract.extractFile(catsZip, { dir: catsOut });
}

async function testBufferExtract() {
    await deleteCats()
    const catsBuf = await fs.promises.readFile(catsZip)
    await extract.extractBuffer(catsBuf, { dir: catsOut, excludedFiles: ["a-cat.png"] });
}

testFileExtract()
testBufferExtract()
