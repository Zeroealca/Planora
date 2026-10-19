import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'

const envFile = '.env.e2e.local'
const primaryEmail = 'planora-e2e-a@example.com'
const secondaryEmail = 'planora-e2e-b@example.com'

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2] ?? match[3] ?? '']),
  )
}

function localStatus() {
  const output = execFileSync('npm', ['exec', 'supabase', '--', 'status', '-o', 'env'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  const values = parseEnv(output)
  const url = new URL(values.API_URL ?? '')
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Supabase status did not return a local API URL; refusing E2E setup.')
  }
  if (!values.ANON_KEY || !values.SERVICE_ROLE_KEY) {
    throw new Error('Local Supabase status did not provide the required local keys.')
  }
  return { url: url.origin, anonKey: values.ANON_KEY, serviceRoleKey: values.SERVICE_ROLE_KEY }
}

function password(existing) {
  return existing || `Planora-e2e-${randomBytes(18).toString('base64url')}`
}

async function adminRequest(config, path, method, body) {
  const response = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    throw new Error(`Local Supabase admin request failed (${method} ${path}): ${await response.text()}`)
  }
  return response.status === 204 ? null : response.json()
}

async function ensureUser(config, email, userPassword) {
  const result = await adminRequest(config, '/auth/v1/admin/users?page=1&per_page=1000', 'GET')
  const existing = result.users.find((user) => user.email === email)
  if (existing) {
    await adminRequest(config, `/auth/v1/admin/users/${existing.id}`, 'PUT', {
      password: userPassword,
      email_confirm: true,
    })
    return existing.id
  }

  const created = await adminRequest(config, '/auth/v1/admin/users', 'POST', {
    email,
    password: userPassword,
    email_confirm: true,
  })
  return created.id
}

async function ensureFinancialCategory(config, userId) {
  const headers = {
    apikey: config.serviceRoleKey,
    authorization: `Bearer ${config.serviceRoleKey}`,
    'content-type': 'application/json',
  }
  const query = new URLSearchParams({ user_id: `eq.${userId}`, name: 'eq.E2E Essentials' })
  const existing = await fetch(`${config.url}/rest/v1/financial_categories?${query}`, { headers })
  if (!existing.ok) throw new Error(`Unable to read local E2E category: ${await existing.text()}`)
  if ((await existing.json()).length > 0) return

  const created = await fetch(`${config.url}/rest/v1/financial_categories`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=minimal' },
    body: JSON.stringify({ user_id: userId, name: 'E2E Essentials' }),
  })
  if (!created.ok) throw new Error(`Unable to create local E2E category: ${await created.text()}`)
}

const previous = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {}
const config = localStatus()
const primaryPassword = password(previous.E2E_USER_PASSWORD)
const secondaryPassword = password(previous.E2E_USER_B_PASSWORD)
const primaryUserId = await ensureUser(config, primaryEmail, primaryPassword)
const secondaryUserId = await ensureUser(config, secondaryEmail, secondaryPassword)
await Promise.all([
  ensureFinancialCategory(config, primaryUserId),
  ensureFinancialCategory(config, secondaryUserId),
])

writeFileSync(
  envFile,
  [
    '# Generated for the local Docker stack. Never commit this file.',
    'E2E_LOCAL_SUPABASE=true',
    `E2E_SUPABASE_URL=${config.url}`,
    `E2E_SUPABASE_ANON_KEY=${config.anonKey}`,
    `E2E_SERVICE_ROLE_KEY=${config.serviceRoleKey}`,
    `E2E_USER_EMAIL=${primaryEmail}`,
    `E2E_USER_PASSWORD=${primaryPassword}`,
    `E2E_USER_B_EMAIL=${secondaryEmail}`,
    `E2E_USER_B_PASSWORD=${secondaryPassword}`,
    '',
  ].join('\n'),
  { mode: 0o600 },
)

console.log('Prepared two confirmed local E2E users and their baseline financial categories.')
