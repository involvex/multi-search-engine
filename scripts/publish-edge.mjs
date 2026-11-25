#!/usr/bin/env node
/**
 * Upload / publish a Multi Search package to an existing Edge Add-ons product (API v1.1).
 * Does not create a product or update listing metadata — use Partner Center for that.
 *
 * Usage:
 *   bun run edge:upload
 *   bun run edge:upload -- --dry-run
 *   bun run edge:upload -- --upload
 *   bun run edge:upload -- --upload --publish
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const API_ROOT = 'https://api.addons.microsoftedge.microsoft.com'
const PACKAGE_DIR = join(ROOT, 'package')

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return
  }

  const text = readFileSync(path, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const eq = trimmed.indexOf('=')
    if (eq <= 0) {
      continue
    }

    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const flags = new Set(argv)
  return {
    dryRun: flags.has('--dry-run') || (!flags.has('--upload') && !flags.has('--publish')),
    upload: flags.has('--upload') || flags.has('--publish'),
    publish: flags.has('--publish'),
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and fill in Partner Center values.`)
  }
  return value
}

function findLatestZip() {
  if (!existsSync(PACKAGE_DIR)) {
    throw new Error(`No package/ folder. Run bun run zip first.`)
  }

  const zips = readdirSync(PACKAGE_DIR)
    .filter((name) => name.toLowerCase().endsWith('.zip'))
    .map((name) => {
      const path = join(PACKAGE_DIR, name)
      return { path, mtimeMs: statSync(path).mtimeMs }
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs)

  if (zips.length === 0) {
    throw new Error(`No .zip in package/. Run bun run zip first.`)
  }

  return zips[zips.length - 1].path
}

function authHeaders(clientId, apiKey, contentType) {
  const headers = {
    Authorization: `ApiKey ${apiKey}`,
    'X-ClientID': clientId,
  }
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  return headers
}

function operationIdFromLocation(location) {
  if (!location) {
    return ''
  }
  const parts = location.split('/').filter(Boolean)
  return parts[parts.length - 1] ?? ''
}

async function pollOperation({ url, clientId, apiKey, label, limit = 30, delayMs = 5000 }) {
  for (let attempt = 1; attempt <= limit; attempt += 1) {
    const response = await fetch(url, {
      method: 'GET',
      headers: authHeaders(clientId, apiKey),
    })
    const text = await response.text()
    let body
    try {
      body = text ? JSON.parse(text) : {}
    } catch {
      body = { raw: text }
    }

    const status = body.status ?? body.Status ?? 'Unknown'
    console.log(`${label} poll ${attempt}/${limit}: HTTP ${response.status}, status=${status}`)

    if (status === 'Succeeded' || status === 'Success') {
      return body
    }
    if (status === 'Failed' || status === 'Cancelled') {
      throw new Error(`${label} failed: ${JSON.stringify(body)}`)
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, delayMs))
  }

  throw new Error(`${label} timed out while InProgress`)
}

async function uploadPackage({ productId, clientId, apiKey, zipPath }) {
  const endpoint = `${API_ROOT}/v1/products/${productId}/submissions/draft/package`
  const zipBytes = readFileSync(zipPath)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: authHeaders(clientId, apiKey, 'application/zip'),
    body: zipBytes,
  })

  if (response.status !== 202) {
    const text = await response.text()
    throw new Error(`Upload failed HTTP ${response.status}: ${text}`)
  }

  const location = response.headers.get('Location') ?? response.headers.get('location') ?? ''
  const operationId = operationIdFromLocation(location)
  if (!operationId) {
    throw new Error('Upload accepted but Location / operation id was missing.')
  }

  console.log(`Upload accepted. operationId=${operationId}`)
  const statusUrl = `${API_ROOT}/v1/products/${productId}/submissions/draft/package/operations/${operationId}`
  await pollOperation({
    url: statusUrl,
    clientId,
    apiKey,
    label: 'Upload',
  })
}

async function publishSubmission({ productId, clientId, apiKey, notes }) {
  const endpoint = `${API_ROOT}/v1/products/${productId}/submissions`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...authHeaders(clientId, apiKey, 'application/json'),
    },
    body: JSON.stringify({ notes }),
  })

  if (response.status !== 202) {
    const text = await response.text()
    throw new Error(`Publish failed HTTP ${response.status}: ${text}`)
  }

  const location = response.headers.get('Location') ?? response.headers.get('location') ?? ''
  const operationId = operationIdFromLocation(location)
  if (!operationId) {
    throw new Error('Publish accepted but Location / operation id was missing.')
  }

  console.log(`Publish accepted. operationId=${operationId}`)
  const statusUrl = `${API_ROOT}/v1/products/${productId}/submissions/operations/${operationId}`
  await pollOperation({
    url: statusUrl,
    clientId,
    apiKey,
    label: 'Publish',
  })
}

async function main() {
  loadEnvFile(join(ROOT, '.env'))
  const args = parseArgs(process.argv.slice(2))

  const clientId = requireEnv('MICROSOFT_CLIENT_ID')
  const apiKey = requireEnv('MICROSOFT_API_KEY')
  const productId = requireEnv('EDGE_PRODUCT_ID')
  const zipPath = findLatestZip()
  const uploadEndpoint = `${API_ROOT}/v1/products/${productId}/submissions/draft/package`

  console.log('Edge Add-ons update (v1.1)')
  console.log(`  zip:      ${zipPath}`)
  console.log(`  product:  ${productId}`)
  console.log(`  endpoint: ${uploadEndpoint}`)
  console.log(`  mode:     ${args.dryRun ? 'dry-run' : args.publish ? 'upload+publish' : 'upload'}`)

  if (args.dryRun) {
    console.log('Dry-run only. Pass --upload to POST the package (needs an existing product).')
    return
  }

  await uploadPackage({ productId, clientId, apiKey, zipPath })
  console.log('Package upload succeeded.')

  if (args.publish) {
    await publishSubmission({
      productId,
      clientId,
      apiKey,
      notes: 'Automated package update from Multi Search publish-edge.mjs',
    })
    console.log('Publish request succeeded.')
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
