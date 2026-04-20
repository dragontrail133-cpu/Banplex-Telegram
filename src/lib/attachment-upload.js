const DEFAULT_IMAGE_COMPRESSION_THRESHOLD_BYTES = 768 * 1024
const DEFAULT_IMAGE_MAX_WIDTH = 1600
const DEFAULT_IMAGE_MAX_HEIGHT = 1600
const DEFAULT_IMAGE_QUALITY = 0.82

const COMPRESSIBLE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function normalizeNumber(value, fallback) {
  const amount = Number(value)

  return Number.isFinite(amount) && amount > 0 ? amount : fallback
}

function isCompressibleImage(file) {
  return (
    file instanceof File &&
    COMPRESSIBLE_IMAGE_TYPES.has(String(file.type ?? '').toLowerCase())
  )
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Gagal membaca gambar untuk kompresi attachment.'))
    }

    image.src = objectUrl
  })
}

async function compressImageFile(file, options = {}) {
  if (!(file instanceof File) || !isCompressibleImage(file)) {
    return {
      file,
      summary: {
        didCompress: false,
        originalSizeBytes: file?.size ?? 0,
        finalSizeBytes: file?.size ?? 0,
        savedBytes: 0,
        originalWidth: null,
        originalHeight: null,
        finalWidth: null,
        finalHeight: null,
      },
    }
  }

  const thresholdBytes = normalizeNumber(
    options.thresholdBytes,
    DEFAULT_IMAGE_COMPRESSION_THRESHOLD_BYTES
  )

  if (file.size < thresholdBytes) {
    return {
      file,
      summary: {
        didCompress: false,
        originalSizeBytes: file.size,
        finalSizeBytes: file.size,
        savedBytes: 0,
        originalWidth: null,
        originalHeight: null,
        finalWidth: null,
        finalHeight: null,
      },
    }
  }

  const maxWidth = normalizeNumber(options.maxWidth, DEFAULT_IMAGE_MAX_WIDTH)
  const maxHeight = normalizeNumber(options.maxHeight, DEFAULT_IMAGE_MAX_HEIGHT)
  const quality = Math.min(Math.max(Number(options.quality) || DEFAULT_IMAGE_QUALITY, 0.3), 0.95)
  const image = await loadImageElement(file)
  const scaleRatio = Math.min(1, maxWidth / image.width, maxHeight / image.height)
  const targetWidth = Math.max(1, Math.round(image.width * scaleRatio))
  const targetHeight = Math.max(1, Math.round(image.height * scaleRatio))
  const canvas = document.createElement('canvas')

  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Canvas kompresi attachment tidak tersedia.')
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise((resolve) => {
    canvas.toBlob(resolve, file.type || 'image/jpeg', quality)
  })

  if (!(blob instanceof Blob)) {
    throw new Error('Blob hasil kompresi attachment gagal dibentuk.')
  }

  if (blob.size >= file.size) {
    return {
      file,
      summary: {
        didCompress: false,
        originalSizeBytes: file.size,
        finalSizeBytes: file.size,
        savedBytes: 0,
        originalWidth: image.width,
        originalHeight: image.height,
        finalWidth: image.width,
        finalHeight: image.height,
      },
    }
  }

  const compressedFile = new File([blob], file.name, {
    type: blob.type || file.type,
    lastModified: file.lastModified,
  })

  return {
    file: compressedFile,
    summary: {
      didCompress: true,
      originalSizeBytes: file.size,
      finalSizeBytes: compressedFile.size,
      savedBytes: Math.max(file.size - compressedFile.size, 0),
      originalWidth: image.width,
      originalHeight: image.height,
      finalWidth: targetWidth,
      finalHeight: targetHeight,
    },
  }
}

export { compressImageFile }
