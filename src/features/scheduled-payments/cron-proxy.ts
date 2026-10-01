/**
 * Vercel Cron → Supabase Edge Function proxy.
 * Authorization and HTTP glue only; reminder business logic stays in Supabase.
 */

export type CronProxyEnv = {
  CRON_SECRET?: string
  REMINDER_JOB_SECRET?: string
  /** Public Supabase project URL (not a secret). Prefer if set server-side. */
  SUPABASE_URL?: string
  /** Existing Vite public URL; safe to reuse server-side (URL is not secret). */
  VITE_SUPABASE_URL?: string
}

export type CronProxyResult = {
  status: number
  body: Record<string, unknown>
}

export function resolveSupabaseUrl(env: CronProxyEnv): string | null {
  const raw = env.SUPABASE_URL?.trim() || env.VITE_SUPABASE_URL?.trim() || ''
  if (raw === '') return null
  return raw.replace(/\/$/, '')
}

export function buildRemindersProcessorUrl(supabaseUrl: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/process-scheduled-payment-reminders`
}

/** Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is set. */
export function authorizeVercelCron(
  authorizationHeader: string | null | undefined,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret || cronSecret.trim() === '') return false
  if (!authorizationHeader) return false
  return authorizationHeader === `Bearer ${cronSecret}`
}

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const raw = headers[name] ?? headers[name.toLowerCase()]
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  return null
}

export function readAuthorizationHeader(
  headers: Record<string, string | string[] | undefined>,
): string | null {
  return headerValue(headers, 'authorization')
}

/**
 * Invokes the deployed Supabase reminder processor. Never returns secret values.
 */
export async function invokeScheduledPaymentRemindersProcessor(input: {
  supabaseUrl: string
  reminderJobSecret: string
  fetchFn?: typeof fetch
  body?: Record<string, unknown>
}): Promise<CronProxyResult> {
  const fetchFn = input.fetchFn ?? fetch
  const url = buildRemindersProcessorUrl(input.supabaseUrl)

  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-reminder-job-secret': input.reminderJobSecret,
      },
      body: JSON.stringify(input.body ?? {}),
    })
  } catch (err) {
    console.error(
      JSON.stringify({
        event: 'reminder_cron_proxy_fetch_error',
        message: err instanceof Error ? err.message : 'fetch failed',
      }),
    )
    return {
      status: 502,
      body: { ok: false, error: 'processor_unreachable' },
    }
  }

  const text = await response.text()
  let processorBody: unknown = null
  if (text.trim() !== '') {
    try {
      processorBody = JSON.parse(text) as unknown
    } catch {
      processorBody = { raw: text.slice(0, 200) }
    }
  }

  if (!response.ok) {
    console.error(
      JSON.stringify({
        event: 'reminder_cron_proxy_processor_error',
        status: response.status,
      }),
    )
    return {
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      body: {
        ok: false,
        error: 'processor_failed',
        processorStatus: response.status,
        processor: sanitizeProcessorBody(processorBody),
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      processor: sanitizeProcessorBody(processorBody),
    },
  }
}

function sanitizeProcessorBody(body: unknown): unknown {
  if (body == null) return null
  if (typeof body !== 'object' || Array.isArray(body)) return body
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) }
  for (const key of Object.keys(clone)) {
    if (/secret|api[_-]?key|token|authorization|password/i.test(key)) {
      delete clone[key]
    }
  }
  return clone
}

export async function runScheduledPaymentRemindersCron(input: {
  authorizationHeader: string | null | undefined
  env: CronProxyEnv
  fetchFn?: typeof fetch
  body?: Record<string, unknown>
}): Promise<CronProxyResult> {
  if (!authorizeVercelCron(input.authorizationHeader, input.env.CRON_SECRET)) {
    return { status: 401, body: { ok: false, error: 'unauthorized' } }
  }

  const supabaseUrl = resolveSupabaseUrl(input.env)
  const reminderJobSecret = input.env.REMINDER_JOB_SECRET?.trim()
  if (!supabaseUrl || !reminderJobSecret) {
    console.error(
      JSON.stringify({
        event: 'reminder_cron_proxy_misconfigured',
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasReminderJobSecret: Boolean(reminderJobSecret),
      }),
    )
    return { status: 500, body: { ok: false, error: 'misconfigured' } }
  }

  return invokeScheduledPaymentRemindersProcessor({
    supabaseUrl,
    reminderJobSecret,
    fetchFn: input.fetchFn,
    body: input.body,
  })
}
