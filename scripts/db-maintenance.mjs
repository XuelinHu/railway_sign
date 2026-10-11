import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { DATA_DIR, DB_FILE } from '../server/api/lib/paths.js'

const timestamp = () => new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')

function getOption(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return null
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`)
  return path.resolve(value)
}

function pathEntryExists(file) {
  try {
    fs.lstatSync(file)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function assertDatabaseFile(file, label) {
  let stat
  try {
    stat = fs.lstatSync(file)
  } catch (error) {
    throw new Error(`${label} does not exist: ${file}`)
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file: ${file}`)
}

function assertIntegrity(file) {
  const database = new DatabaseSync(file, { readOnly: true, timeout: 5000 })
  try {
    const result = database.prepare('PRAGMA integrity_check').get()
    if (!result || Object.values(result)[0] !== 'ok') {
      throw new Error(`${file} failed SQLite integrity_check`)
    }
  } finally {
    database.close()
  }
}

function snapshot(source, destination) {
  assertDatabaseFile(source, 'Source database')
  if (source === destination) throw new Error('Source and destination must be different files')
  if (pathEntryExists(destination)) throw new Error(`Refusing to overwrite existing file: ${destination}`)
  fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o700 })

  let snapshotCreated = false
  try {
    const database = new DatabaseSync(source, { readOnly: true, timeout: 5000 })
    try {
      database.prepare('VACUUM INTO ?').run(destination)
      snapshotCreated = true
    } finally {
      database.close()
    }
    if (process.platform !== 'win32') fs.chmodSync(destination, 0o600)
    assertIntegrity(destination)
  } catch (error) {
    if (snapshotCreated) fs.rmSync(destination, { force: true })
    throw error
  }
}

function backup(args) {
  const source = path.resolve(process.env.API_DB_FILE || DB_FILE)
  const destination = getOption(args, '--destination') || path.join(DATA_DIR, 'backups', `railway_sign-${timestamp()}.sqlite`)
  snapshot(source, destination)
  return { action: 'backup', source, backup: destination, integrity: 'ok' }
}

function checkpoint(file) {
  const database = new DatabaseSync(file, { timeout: 5000 })
  try {
    const result = database.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get()
    if (Number(result?.busy || 0) !== 0) throw new Error('Database is busy; stop the API and retry restore')
  } finally {
    database.close()
  }
}

function restore(args) {
  const source = getOption(args, '--source')
  if (!source) throw new Error('restore requires --source')
  const target = getOption(args, '--target') || path.resolve(process.env.API_DB_FILE || DB_FILE)
  const replace = args.includes('--replace')
  assertDatabaseFile(source, 'Backup database')
  if (source === target) throw new Error('Backup and target must be different files')

  const targetExists = pathEntryExists(target)
  if (targetExists && !replace) throw new Error(`Target exists; pass --replace to replace it: ${target}`)
  if (targetExists) assertDatabaseFile(target, 'Target database')

  const candidate = path.join(path.dirname(target), `.${path.basename(target)}.${process.pid}.${Date.now()}.restore`)
  snapshot(source, candidate)

  let previous = null
  const sidecars = []
  let targetMoved = false
  let installed = false
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
    if (targetExists) {
      previous = `${target}.pre-restore-${timestamp()}`
      if (pathEntryExists(previous)) throw new Error(`Refusing to overwrite rollback file: ${previous}`)
      checkpoint(target)
      fs.renameSync(target, previous)
      targetMoved = true
      for (const suffix of ['-wal', '-shm']) {
        const sidecar = `${target}${suffix}`
        if (!pathEntryExists(sidecar)) continue
        const previousSidecar = `${previous}${suffix}`
        fs.renameSync(sidecar, previousSidecar)
        sidecars.push([sidecar, previousSidecar])
      }
    }

    fs.renameSync(candidate, target)
    installed = true
    assertIntegrity(target)
  } catch (error) {
    if (installed) fs.rmSync(target, { force: true })
    if (targetMoved && previous && pathEntryExists(previous)) fs.renameSync(previous, target)
    for (const [sidecar, savedSidecar] of sidecars.reverse()) {
      if (pathEntryExists(savedSidecar)) fs.renameSync(savedSidecar, sidecar)
    }
    throw error
  } finally {
    fs.rmSync(candidate, { force: true })
  }

  return { action: 'restore', source, target, previous, integrity: 'ok' }
}

try {
  const [command, ...args] = process.argv.slice(2)
  let result
  if (command === 'backup') result = backup(args)
  else if (command === 'restore') result = restore(args)
  else throw new Error('Usage: db-maintenance.mjs backup [--destination PATH] | restore --source PATH [--target PATH] [--replace]')
  console.log(JSON.stringify(result, null, 2))
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
