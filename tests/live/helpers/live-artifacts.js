import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const DEFAULT_ARTIFACT_PATH = path.resolve(
  process.cwd(),
  'test-results',
  'live-smoke-created-records.json'
)

function buildSmokePrefix() {
  const timestamp = new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace('Z', '')

  return `AQ-SMOKE-${timestamp}`
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function createLiveSmokeArtifact({
  artifactPath = DEFAULT_ARTIFACT_PATH,
  baseURL = null,
  smokePrefix = String(process.env.E2E_SMOKE_PREFIX ?? '').trim() || buildSmokePrefix(),
} = {}) {
  const resolvedPath = path.resolve(artifactPath)
  const artifact = {
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    base_url: baseURL,
    smoke_prefix: smokePrefix,
    records: {},
    steps: [],
  }

  await writeJson(resolvedPath, artifact)

  return {
    artifact,
    artifactPath: resolvedPath,
    smokePrefix,
    async addStep(label, detail = {}) {
      artifact.steps.push({
        at: new Date().toISOString(),
        label,
        detail,
      })
      artifact.updated_at = new Date().toISOString()
      await writeJson(resolvedPath, artifact)
    },
    async record(key, value) {
      artifact.records[key] = value
      artifact.updated_at = new Date().toISOString()
      await writeJson(resolvedPath, artifact)
    },
  }
}

export { createLiveSmokeArtifact, DEFAULT_ARTIFACT_PATH }
