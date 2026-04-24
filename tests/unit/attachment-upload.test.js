import assert from 'node:assert/strict'
import test from 'node:test'

import { compressImageFile } from '../../src/lib/attachment-upload.js'

test('compressImageFile compresses large image attachments', async () => {
  const originalDocument = globalThis.document
  const originalImage = globalThis.Image
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  try {
    URL.createObjectURL = () => 'blob:mock-image'
    URL.revokeObjectURL = () => {}

    globalThis.Image = class {
      constructor() {
        this.width = 4000
        this.height = 3000
        this.onload = null
        this.onerror = null
      }

      set src(_value) {
        queueMicrotask(() => {
          if (typeof this.onload === 'function') {
            this.onload()
          }
        })
      }
    }

    globalThis.document = {
      createElement(tagName) {
        assert.equal(tagName, 'canvas')

        return {
          width: 0,
          height: 0,
          getContext() {
            return {
              drawImage() {},
            }
          },
          toBlob(callback, type) {
            callback(new Blob(['compressed'], { type: type || 'image/jpeg' }))
          },
        }
      },
    }

    const originalFile = new File(
      [new Uint8Array(2 * 1024 * 1024)],
      'attachment.jpg',
      {
        type: 'image/jpeg',
        lastModified: 1700000000000,
      }
    )

    const result = await compressImageFile(originalFile)

    assert.equal(result.summary.didCompress, true)
    assert.ok(result.file.size < originalFile.size)
    assert.equal(result.file.type, 'image/jpeg')
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document
    } else {
      globalThis.document = originalDocument
    }

    if (originalImage === undefined) {
      delete globalThis.Image
    } else {
      globalThis.Image = originalImage
    }

    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})

test('compressImageFile leaves pdf attachments unchanged', async () => {
  const originalFile = new File(
    [new Uint8Array([1, 2, 3])],
    'attachment.pdf',
    {
      type: 'application/pdf',
      lastModified: 1700000000000,
    }
  )

  const result = await compressImageFile(originalFile)

  assert.equal(result.summary.didCompress, false)
  assert.equal(result.file, originalFile)
})
