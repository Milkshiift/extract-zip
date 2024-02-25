const { createWriteStream, promises: fs } = require('fs')
const path = require('path')
const { promisify } = require('util')
const stream = require('stream')
const yauzl = require('yauzl')

const fromBuffer = promisify(yauzl.fromBuffer)
const openZip = promisify(yauzl.open)
const pipeline = promisify(stream.pipeline)

const yauzlOpts = { lazyEntries: true }

class Extractor {
  constructor (opts) {
    this.opts = opts
    this.excludedFiles = opts.excludedFiles || []
  }

  async extractFile (zipPath) {
    const zipfile = await openZip(zipPath, yauzlOpts)
    return this.extract(zipfile)
  }

  async extractBuffer (buffer) {
    const zipfile = await fromBuffer(buffer, yauzlOpts)
    return this.extract(zipfile)
  }

  async extract (zipfile) {
    await this.ensureDir()

    this.zipfile = zipfile
    this.canceled = false

    return new Promise((resolve, reject) => {
      this.zipfile.on('error', (err) => {
        this.canceled = true
        reject(err)
      })
      this.zipfile.readEntry()

      this.zipfile.on('end', () => {
        resolve()
      })

      this.zipfile.on('entry', async (entry) => {
        if (this.canceled) {
          return
        }

        if (entry.fileName.startsWith('__MACOSX/')) {
          this.zipfile.readEntry()
          return
        }

        if (this.excludedFiles.includes(entry.fileName)) {
          this.zipfile.readEntry()
          return
        }

        const destDir = path.dirname(path.join(this.opts.dir, entry.fileName))

        try {
          await fs.mkdir(destDir, { recursive: true })

          const canonicalDestDir = await fs.realpath(destDir)
          const relativeDestDir = path.relative(
              this.opts.dir,
              canonicalDestDir
          )

          if (relativeDestDir.split(path.sep).includes('..')) {
            throw new Error(`Out of bound path "${canonicalDestDir}" found while processing file ${entry.fileName}`)
          }

          await this.extractEntry(entry)
          this.zipfile.readEntry()
        } catch (err) {
          this.canceled = true
          this.zipfile.close()
          reject(err)
        }
      })
    })
  }

  async extractEntry (entry) {
    if (this.canceled) {
      return
    }

    if (this.opts.onEntry) {
      this.opts.onEntry(entry, this.zipfile)
    }

    const dest = path.join(this.opts.dir, entry.fileName)

    // convert external file attr int into a fs stat mode int
    const mode = (entry.externalFileAttributes >> 16) & 0xFFFF

    const IFMT = 61440
    const IFDIR = 16384
    let isDir = (mode & IFMT) === IFDIR

    // Failsafe, borrowed from jsZip
    if (!isDir && entry.fileName.endsWith('/')) {
      isDir = true
    }

    // check for windows weird way of specifying a directory
    // https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
    const madeBy = entry.versionMadeBy >> 8
    if (!isDir) isDir = (madeBy === 0 && entry.externalFileAttributes === 16)

    const procMode = this.getExtractedMode(mode, isDir) & 0o777

    // always ensure folders are created
    const destDir = isDir ? dest : path.dirname(dest)

    const mkdirOptions = { recursive: true }
    if (isDir) {
      mkdirOptions.mode = procMode
    }

    await fs.mkdir(destDir, mkdirOptions)
    if (isDir) return

    const readStream = await promisify(this.zipfile.openReadStream.bind(this.zipfile))(entry)

    await pipeline(readStream, createWriteStream(dest, { mode: procMode }))
  }

  getExtractedMode (entryMode, isDir) {
    let mode = entryMode
    // Set defaults, if necessary
    if (mode === 0) {
      if (isDir) {
        if (this.opts.defaultDirMode) {
          mode = parseInt(this.opts.defaultDirMode, 10)
        }

        if (!mode) {
          mode = 0o755
        }
      } else {
        if (this.opts.defaultFileMode) {
          mode = parseInt(this.opts.defaultFileMode, 10)
        }

        if (!mode) {
          mode = 0o644
        }
      }
    }

    return mode
  }

  async ensureDir () {
    if (!path.isAbsolute(this.opts.dir)) {
      throw new Error('Target directory is expected to be absolute')
    }

    await fs.mkdir(this.opts.dir, { recursive: true })
    this.opts.dir = await fs.realpath(this.opts.dir)
  }
}

async function extractFile (filename, opts) {
  return new Extractor(opts).extractFile(filename)
}

async function extractBuffer (buffer, opts) {
  return new Extractor(opts).extractBuffer(buffer)
}

module.exports = extractFile
module.exports.extractBuffer = extractBuffer
module.exports.extractFile = extractFile
