import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { chmod, link, mkdir, mkdtemp, open, rm, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { DATA_DIR, DATABASE_NAME } from '../server/api/lib/paths.js'

const PROJECT = 'railway_sign'
const MAGIC = Buffer.from('RSIGNPG1')
const NONCE_BYTES = 12
const TAG_BYTES = 16
const MAX_METADATA_BYTES = 4096

export function parseBackupKey(value) {
  if (!/^[\da-f]{64}$/i.test(String(value || ''))) {
    throw new Error('DB_BACKUP_ENCRYPTION_KEY must be exactly 64 hexadecimal characters')
  }
  return Buffer.from(value, 'hex')
}

export function validateDatabaseName(value) {
  if (!/^[a-z][a-z0-9_]{0,62}$/i.test(String(value || ''))) {
    throw new Error('Database name is not a safe PostgreSQL identifier')
  }
  return value
}

export function assertSafeRestoreTarget({ targetDatabase, sourceDatabase, replace }) {
  validateDatabaseName(targetDatabase)
  validateDatabaseName(sourceDatabase)
  if (targetDatabase === sourceDatabase) throw new Error('Restore target must differ from the source database')
  if (!targetDatabase.endsWith('_test')) throw new Error('Restore target must end in _test')
  if (replace !== true) throw new Error('Restore requires explicit --replace confirmation')
}

function parseArgs(argv) {
  const [action, ...rest] = argv
  const options = {}
  for (let index = 0; index < rest.length; index += 1) {
    const item = rest[index]
    if (item === '--replace') options.replace = true
    else if (item === '--help') options.help = true
    else if (item.startsWith('--')) {
      const value = rest[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${item}`)
      options[item.slice(2)] = value
      index += 1
    } else throw new Error(`Unknown argument: ${item}`)
  }
  return { action, options }
}

function connectionEnv(env) {
  const values = {
    PGHOST: env.PGHOST || '127.0.0.1',
    PGPORT: String(env.PGPORT || '5432'),
    PGUSER: env.PGUSER || 'railway_sign_app',
    PGPASSWORD: env.PGPASSWORD,
  }
  for (const [name, value] of Object.entries(values)) if (!value) throw new Error(`Missing PostgreSQL connection setting: ${name}`)
  if (!/^\d{1,5}$/.test(values.PGPORT) || Number(values.PGPORT) < 1 || Number(values.PGPORT) > 65535) {
    throw new Error('PGPORT is invalid')
  }
  return { ...env, ...values }
}

function toolPath(name) {
  const binary = process.platform === 'win32' ? `${name}.exe` : name
  return process.env.PG_BIN_DIR ? path.join(process.env.PG_BIN_DIR, binary) : binary
}

function runTool(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-4000) })
    child.on('error', (error) => reject(new Error(`${path.basename(command)} could not start: ${error.message}`)))
    child.on('close', (code) => code === 0
      ? resolve()
      : reject(new Error(`${path.basename(command)} failed with exit code ${code}${stderr ? `: ${stderr.trim()}` : ''}`)))
  })
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function makeHeader(metadata, nonce) {
  const metadataBytes = Buffer.from(JSON.stringify(metadata))
  if (metadataBytes.length > MAX_METADATA_BYTES) throw new Error('Backup metadata is too large')
  const prefix = Buffer.alloc(MAGIC.length + 4 + metadataBytes.length + NONCE_BYTES + TAG_BYTES)
  MAGIC.copy(prefix)
  prefix.writeUInt32BE(metadataBytes.length, MAGIC.length)
  metadataBytes.copy(prefix, MAGIC.length + 4)
  nonce.copy(prefix, MAGIC.length + 4 + metadataBytes.length)
  return { prefix, metadataBytes, tagOffset: prefix.length - TAG_BYTES }
}

export async function encryptArchiveFile(sourcePath, destinationPath, metadata, key) {
  const nonce = randomBytes(NONCE_BYTES)
  const { prefix, metadataBytes, tagOffset } = makeHeader(metadata, nonce)
  const partialPath = `${destinationPath}.${process.pid}.${randomBytes(6).toString('hex')}.partial`
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  cipher.setAAD(Buffer.concat([MAGIC, metadataBytes]))
  try {
    await writeFile(partialPath, prefix, { flag: 'wx', mode: 0o600 })
    await pipeline(createReadStream(sourcePath), cipher, createWriteStream(partialPath, { flags: 'a', mode: 0o600 }))
    const handle = await open(partialPath, 'r+')
    try {
      await handle.write(cipher.getAuthTag(), 0, TAG_BYTES, tagOffset)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await link(partialPath, destinationPath)
    await chmod(destinationPath, 0o600).catch(() => {})
  } finally {
    await unlink(partialPath).catch(() => {})
  }
}

async function readHeader(sourcePath) {
  const handle = await open(sourcePath, 'r')
  try {
    const fixed = Buffer.alloc(MAGIC.length + 4)
    const fixedRead = await handle.read(fixed, 0, fixed.length, 0)
    if (fixedRead.bytesRead !== fixed.length || !fixed.subarray(0, MAGIC.length).equals(MAGIC)) {
      throw new Error('Unsupported or invalid backup format')
    }
    const metadataLength = fixed.readUInt32BE(MAGIC.length)
    if (metadataLength < 2 || metadataLength > MAX_METADATA_BYTES) throw new Error('Invalid backup metadata length')
    const metadataBytes = Buffer.alloc(metadataLength)
    const nonce = Buffer.alloc(NONCE_BYTES)
    const tag = Buffer.alloc(TAG_BYTES)
    let offset = fixed.length
    for (const [buffer, size] of [[metadataBytes, metadataLength], [nonce, NONCE_BYTES], [tag, TAG_BYTES]]) {
      const result = await handle.read(buffer, 0, size, offset)
      if (result.bytesRead !== size) throw new Error('Backup file is truncated')
      offset += size
    }
    let metadata
    try { metadata = JSON.parse(metadataBytes.toString('utf8')) } catch { throw new Error('Invalid backup metadata') }
    return { metadata, metadataBytes, nonce, tag, offset }
  } finally {
    await handle.close()
  }
}

export async function decryptArchiveFile(sourcePath, targetDirectory, key) {
  const { metadata, metadataBytes, nonce, tag, offset } = await readHeader(sourcePath)
  if (metadata?.format !== 1 || metadata?.project !== PROJECT) throw new Error('Backup belongs to another project or uses an unsupported version')
  validateDatabaseName(metadata.database)
  const directory = await mkdtemp(path.join(targetDirectory, `${PROJECT}-restore-`))
  await chmod(directory, 0o700).catch(() => {})
  const archivePath = path.join(directory, 'restore.dump')
  const decipher = createDecipheriv('aes-256-gcm', key, nonce)
  decipher.setAAD(Buffer.concat([MAGIC, metadataBytes]))
  decipher.setAuthTag(tag)
  try {
    await pipeline(createReadStream(sourcePath, { start: offset }), decipher, createWriteStream(archivePath, { flags: 'wx', mode: 0o600 }))
    return { archivePath, directory, metadata }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    if (/authenticate data|bad decrypt/i.test(error.message)) throw new Error('Backup authentication failed; restore was not started')
    throw error
  }
}

export async function runCli(argv, env = process.env) {
  const { action, options } = parseArgs(argv)
  if (options.help || action === '--help' || !action) {
    console.log('Usage: npm run db:backup [-- --destination <file>]')
    console.log('       npm run db:restore -- --source <file> --target <database_test> --replace')
    return
  }
  const key = parseBackupKey(env.DB_BACKUP_ENCRYPTION_KEY)
  const pgEnv = connectionEnv(env)

  if (action === 'backup') {
    const database = validateDatabaseName(env.PGDATABASE || DATABASE_NAME)
    const destination = path.resolve(options.destination || path.join(DATA_DIR, 'backups', `railway_sign-${database}-${timestamp()}.pgbak`))
    await mkdir(path.dirname(destination), { recursive: true })
    const tempDirectory = await mkdtemp(path.join(tmpdir(), `${PROJECT}-dump-`))
    await chmod(tempDirectory, 0o700).catch(() => {})
    const dumpPath = path.join(tempDirectory, 'database.dump')
    try {
      await runTool(toolPath('pg_dump'), [
        '--format=custom', '--no-owner', '--no-acl', '--host', pgEnv.PGHOST,
        '--port', pgEnv.PGPORT, '--username', pgEnv.PGUSER,
        '--dbname', database, '--file', dumpPath,
      ], pgEnv)
      await encryptArchiveFile(dumpPath, destination, {
        format: 1, project: PROJECT, database, createdAt: new Date().toISOString(),
      }, key)
      console.log(`Encrypted PostgreSQL backup created: ${destination}`)
    } finally {
      await rm(tempDirectory, { recursive: true, force: true })
    }
    return
  }

  if (action === 'restore') {
    if (!options.source || !options.target) throw new Error('restore requires --source and --target')
    const sourceDatabase = validateDatabaseName(env.PGDATABASE || DATABASE_NAME)
    const targetDatabase = validateDatabaseName(options.target)
    assertSafeRestoreTarget({ targetDatabase, sourceDatabase, replace: options.replace })
    const decrypted = await decryptArchiveFile(path.resolve(options.source), tmpdir(), key)
    try {
      if (decrypted.metadata.database !== sourceDatabase) throw new Error('Backup source database does not match PGDATABASE')
      await runTool(toolPath('pg_restore'), [
        '--exit-on-error', '--single-transaction', '--clean', '--if-exists',
        '--no-owner', '--no-acl', '--dbname', targetDatabase, decrypted.archivePath,
      ], pgEnv)
      console.log(`Restored ${sourceDatabase} snapshot to isolated database ${targetDatabase}.`)
    } finally {
      await rm(decrypted.directory, { recursive: true, force: true })
    }
    return
  }
  throw new Error(`Unknown action: ${action}`)
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''
if (invokedPath === fileURLToPath(import.meta.url)) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
