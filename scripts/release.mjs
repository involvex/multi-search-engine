#!/usr/bin/env node
/**
 * Cut a Multi Search release: bump version (patch default), changelog, zip,
 * commit, tag, push, and create a GitHub release with the package artifact.
 *
 * Manifest version is sourced from package.json at build time.
 *
 * Usage:
 *   bun run release
 *   bun run release -- --dry-run
 *   bun run release -- --minor
 *   bun run release -- --major
 *   bun run release -- --version 1.2.3
 *   bun run release -- --notes "feat: something" --notes "fix: other"
 */

import { execFileSync, execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const PACKAGE_JSON = join(ROOT, 'package.json')
const CHANGELOG = join(ROOT, 'CHANGELOG.md')
const PACKAGE_DIR = join(ROOT, 'package')

function parseArgs(argv) {
  let bump = 'patch'
  let version = ''
  let dryRun = false
  const notes = []

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      dryRun = true
    } else if (arg === '--patch') {
      bump = 'patch'
    } else if (arg === '--minor') {
      bump = 'minor'
    } else if (arg === '--major') {
      bump = 'major'
    } else if (arg === '--version') {
      version = argv[i + 1] ?? ''
      i += 1
    } else if (arg.startsWith('--version=')) {
      version = arg.slice('--version='.length)
    } else if (arg === '--notes' || arg === '-m') {
      const note = argv[i + 1] ?? ''
      if (note) {
        notes.push(note)
      }
      i += 1
    } else if (arg.startsWith('--notes=')) {
      notes.push(arg.slice('--notes='.length))
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (version) {
    bump = 'exact'
  }

  return { bump, version, dryRun, notes }
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
  })
}

function runShell(command) {
  return execSync(command, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function assertSemver(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid semver (expected X.Y.Z): ${version}`)
  }
}

function bumpVersion(current, bump) {
  assertSemver(current)
  const [major, minor, patch] = current.split('.').map(Number)
  if (bump === 'major') {
    return `${major + 1}.0.0`
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}

function todayStamp() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}.${mm}.${dd}`
}

function readPackage() {
  return JSON.parse(readFileSync(PACKAGE_JSON, 'utf8'))
}

function writePackageVersion(pkg, version) {
  writeFileSync(PACKAGE_JSON, `${JSON.stringify({ ...pkg, version }, null, 2)}\n`, 'utf8')
}

function collectNotesFromGit(previousTag) {
  const args = ['log', '--pretty=format:%s']
  if (previousTag) {
    args.push(`${previousTag}..HEAD`)
  }

  let log
  try {
    log = run('git', args).trim()
  } catch {
    return []
  }

  if (!log) {
    return []
  }

  return log
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^release:/i.test(line))
    .slice(0, 20)
    .map((line) => `- ${line}`)
}

function prependChangelog(version, bullets) {
  const existing = existsSync(CHANGELOG) ? readFileSync(CHANGELOG, 'utf8') : '# CHANGELOG\n'
  if (existing.includes(`## ${version} [`)) {
    throw new Error(`CHANGELOG already has a section for ${version}`)
  }

  const header = `## ${version} [${todayStamp()}]`
  const body = bullets.length > 0 ? bullets.join('\n') : `- chore: release ${version}`
  const section = `${header}\n\n${body}\n\n`

  const match = existing.match(/\n## \d+\.\d+\.\d+ \[/)
  if (!match || match.index === undefined) {
    writeFileSync(CHANGELOG, `${existing.trimEnd()}\n\n${section}`, 'utf8')
    return
  }

  const insertAt = match.index + 1
  writeFileSync(
    CHANGELOG,
    `${existing.slice(0, insertAt)}${section}${existing.slice(insertAt)}`,
    'utf8',
  )
}

function extractReleaseNotes(version) {
  const text = readFileSync(CHANGELOG, 'utf8')
  const start = text.indexOf(`## ${version} [`)
  if (start === -1) {
    return `Release ${version}`
  }
  const after = text.slice(start)
  const next = after.search(/\n## \d+\.\d+\.\d+ \[/)
  const block = next === -1 ? after : after.slice(0, next)
  return block.trim()
}

function findZipForVersion(version) {
  if (!existsSync(PACKAGE_DIR)) {
    throw new Error('package/ missing after zip.')
  }

  const matches = readdirSync(PACKAGE_DIR)
    .filter((name) => name.toLowerCase().endsWith('.zip') && name.includes(version))
    .map((name) => {
      const path = join(PACKAGE_DIR, name)
      return { path, mtimeMs: statSync(path).mtimeMs }
    })
    .sort((a, b) => a.mtimeMs - b.mtimeMs)

  if (matches.length === 0) {
    throw new Error(`No zip for version ${version} in package/`)
  }

  return matches[matches.length - 1].path
}

function ensureCleanTree() {
  const status = run('git', ['status', '--porcelain']).trim()
  if (!status) {
    return
  }

  const blockers = status
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((line) => {
      const path = line
        .slice(3)
        .trim()
        .replace(/^"+|"+$/g, '')
      return path !== 'public/icons/logo.png' && !path.startsWith('package/')
    })

  if (blockers.length > 0) {
    throw new Error(`Working tree is dirty. Commit or stash changes first:\n${blockers.join('\n')}`)
  }
}

function ensureTools() {
  try {
    run('gh', ['--version'])
  } catch {
    throw new Error('GitHub CLI (gh) is required for creating the release.')
  }
  try {
    run('gh', ['auth', 'status'])
  } catch {
    throw new Error('gh is not authenticated. Run `gh auth login` first.')
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (!args.dryRun) {
    ensureTools()
    ensureCleanTree()
  }

  const pkg = readPackage()
  const previous = pkg.version
  assertSemver(previous)

  const nextVersion = args.bump === 'exact' ? args.version : bumpVersion(previous, args.bump)
  assertSemver(nextVersion)

  if (nextVersion === previous) {
    throw new Error(`Version is already ${previous}`)
  }

  const tag = `v${nextVersion}`
  let previousTag
  try {
    previousTag = run('git', ['describe', '--tags', '--abbrev=0']).trim()
  } catch {
    previousTag = ''
  }

  const noteBullets =
    args.notes.length > 0
      ? args.notes.map((note) => (note.startsWith('- ') ? note : `- ${note}`))
      : collectNotesFromGit(previousTag)

  console.log(
    `Release ${previous} → ${nextVersion} (${args.bump}${args.dryRun ? ', dry-run' : ''})`,
  )
  console.log(`  tag: ${tag}`)
  for (const line of noteBullets.length ? noteBullets : ['- chore: release']) {
    console.log(`  ${line}`)
  }

  if (args.dryRun) {
    console.log('Dry-run only. No files, tags, or releases were changed.')
    return
  }

  writePackageVersion(pkg, nextVersion)
  prependChangelog(nextVersion, noteBullets)
  console.log('Updated package.json + CHANGELOG.md (manifest version comes from package.json)')

  console.log('Building zip…')
  runShell('bun run zip')
  const zipPath = findZipForVersion(nextVersion)
  console.log(`  zip: ${zipPath}`)

  run('git', ['add', 'package.json', 'CHANGELOG.md'])
  run('git', ['commit', '-m', `release: v${nextVersion}`], { stdio: 'inherit' })
  run('git', ['tag', '-a', tag, '-m', `Release ${nextVersion}`], { stdio: 'inherit' })
  run('git', ['push', 'origin', 'HEAD'], { stdio: 'inherit' })
  run('git', ['push', 'origin', tag], { stdio: 'inherit' })

  const notesFile = join(ROOT, `.release-notes-${nextVersion}.md`)
  writeFileSync(notesFile, `${extractReleaseNotes(nextVersion)}\n`, 'utf8')
  try {
    run(
      'gh',
      [
        'release',
        'create',
        tag,
        zipPath,
        '--title',
        `Multi Search ${nextVersion}`,
        '--notes-file',
        notesFile,
      ],
      { stdio: 'inherit' },
    )
  } finally {
    if (existsSync(notesFile)) {
      unlinkSync(notesFile)
    }
  }

  console.log(`Done. GitHub release ${tag} published with ${zipPath}`)
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
