import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

type DeliveryStatus = 'pending' | 'processing' | 'sent' | 'failed'

type CandidateRow = {
  id: string
  user_id: string
  scheduled_payment_id: string
  due_date: string
  expected_amount: number | string | null
  status: string
  scheduled_payments: {
    id: string
    name: string
    active: boolean
    reminder_enabled: boolean
    reminder_days_before: number
    financial_category_id: string
  } | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-reminder-job-secret',
}

const MAX_ATTEMPTS = 10

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function todayCivil(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
}

function isCivilDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return month === 2 && isLeapYear(year) ? 29 : days[month - 1]!
}

function dateOnly(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function calculateReminderDate(dueDate: string, daysBeforeDue: number): string {
  if (daysBeforeDue === 0) return dueDate
  const [year, month, day] = dueDate.split('-').map(Number) as [number, number, number]
  let y = year
  let m = month
  let d = day - daysBeforeDue
  while (d < 1) {
    m -= 1
    if (m < 1) {
      m = 12
      y -= 1
    }
    d += daysInMonth(y, m)
  }
  return dateOnly(y, m, d)
}

function shiftMonth(period: string, delta: number): string {
  const year = Number(period.slice(0, 4))
  const month = Number(period.slice(5, 7))
  const absolute = year * 12 + (month - 1) + delta
  const nextYear = Math.floor(absolute / 12)
  const nextMonth = (absolute % 12) + 1
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}`
}

function reminderWindow(today: string): { start: string; endExclusive: string } {
  const current = today.slice(0, 7)
  const prev = shiftMonth(current, -1)
  const nextNext = shiftMonth(current, 2)
  return { start: `${prev}-01`, endExclusive: `${nextNext}-01` }
}

function formatCivilDateLong(value: string): string {
  const [year, month, day] = value.split('-').map(Number) as [number, number, number]
  const date = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('es', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildEmail(input: {
  paymentName: string
  dueDate: string
  expectedAmount: number | null
  siteUrl: string | null
}): { subject: string; text: string } {
  const dueLabel = formatCivilDateLong(input.dueDate)
  const amountLine =
    input.expectedAmount === null
      ? 'Importe:\nPor registrar'
      : `Importe esperado:\n${formatAmount(input.expectedAmount)}`
  const lines = [
    'Tienes un pago programado próximo.',
    '',
    input.paymentName,
    '',
    'Vencimiento:',
    dueLabel,
    '',
    amountLine,
  ]
  if (input.siteUrl) {
    lines.push('', `Abrir Planora: ${input.siteUrl}`)
  }
  lines.push('', 'Este correo es solo un recordatorio. No registra ningún pago.')
  return {
    subject: `Planora — ${input.paymentName} vence el ${dueLabel}`,
    text: lines.join('\n'),
  }
}

function parseAmount(value: number | string | null): number | null {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function authorizeJob(req: Request): boolean {
  const expected = Deno.env.get('REMINDER_JOB_SECRET')
  if (!expected || expected.trim() === '') return false
  const headerSecret = req.headers.get('x-reminder-job-secret')
  if (headerSecret && headerSecret === expected) return true
  const auth = req.headers.get('Authorization')
  if (auth?.startsWith('Bearer ') && auth.slice(7) === expected) return true
  return false
}

async function sendWithResend(input: {
  to: string
  subject: string
  text: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('REMINDER_FROM_EMAIL')
  if (!apiKey || !from) {
    return { ok: false, error: 'email_provider_not_configured' }
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      text: input.text,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    const safe = body.slice(0, 200).replace(apiKey, '[redacted]')
    return { ok: false, error: `resend_http_${response.status}:${safe}` }
  }

  return { ok: true }
}

async function loadOwnerEmail(
  admin: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  const email = data.user.email.trim()
  return email.includes('@') ? email : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido.' }, 405)
  }
  if (!authorizeJob(req)) {
    return json({ error: 'No autorizado.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: 'Configuración de Supabase incompleta.' }, 500)
  }

  const body = await req.json().catch(() => ({}))
  const today =
    typeof body?.today === 'string' && isCivilDate(body.today) ? body.today : todayCivil()
  const siteUrl = Deno.env.get('PLANORA_SITE_URL')?.trim() || null
  const window = reminderWindow(today)

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: rows, error: listError } = await admin
    .from('scheduled_payment_occurrences')
    .select(
      `
      id,
      user_id,
      scheduled_payment_id,
      due_date,
      expected_amount,
      status,
      scheduled_payments!inner (
        id,
        name,
        active,
        reminder_enabled,
        reminder_days_before,
        financial_category_id
      )
    `,
    )
    .eq('status', 'pending')
    .gte('due_date', window.start)
    .lt('due_date', window.endExclusive)

  if (listError) {
    return json({ error: listError.message }, 500)
  }

  const candidates = (rows ?? []) as CandidateRow[]
  const categoryIds = [
    ...new Set(
      candidates
        .map((row) => row.scheduled_payments?.financial_category_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const archivedByCategory = new Map<string, string | null>()
  if (categoryIds.length > 0) {
    const { data: categories, error: categoryError } = await admin
      .from('financial_categories')
      .select('id, archived_at')
      .in('id', categoryIds)
    if (categoryError) {
      return json({ error: categoryError.message }, 500)
    }
    for (const category of categories ?? []) {
      archivedByCategory.set(category.id, category.archived_at)
    }
  }

  const occurrenceIds = candidates.map((row) => row.id)
  const deliveryByOccurrence = new Map<
    string,
    { id: string; status: DeliveryStatus; attempt_count: number }
  >()

  if (occurrenceIds.length > 0) {
    const { data: deliveries, error: deliveryError } = await admin
      .from('scheduled_payment_reminder_deliveries')
      .select('id, occurrence_id, status, attempt_count')
      .in('occurrence_id', occurrenceIds)
    if (deliveryError) {
      return json({ error: deliveryError.message }, 500)
    }
    for (const delivery of deliveries ?? []) {
      deliveryByOccurrence.set(delivery.occurrence_id, {
        id: delivery.id,
        status: delivery.status as DeliveryStatus,
        attempt_count: delivery.attempt_count,
      })
    }
  }

  const summary = {
    today,
    considered: candidates.length,
    claimed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  const emailCache = new Map<string, string | null>()

  for (const row of candidates) {
    const payment = row.scheduled_payments
    if (!payment) {
      summary.skipped += 1
      continue
    }

    const delivery = deliveryByOccurrence.get(row.id) ?? null
    const categoryKnown = archivedByCategory.has(payment.financial_category_id)
    const categoryArchived = archivedByCategory.get(payment.financial_category_id) ?? null
    const reminderDate = calculateReminderDate(row.due_date, payment.reminder_days_before)
    const eligible =
      payment.reminder_enabled &&
      payment.active &&
      categoryKnown &&
      categoryArchived === null &&
      row.status === 'pending' &&
      reminderDate <= today &&
      delivery?.status !== 'sent' &&
      delivery?.status !== 'processing' &&
      (delivery?.attempt_count ?? 0) < MAX_ATTEMPTS

    if (!eligible) {
      summary.skipped += 1
      continue
    }

    const { data: claimed, error: claimError } = await admin.rpc(
      'claim_scheduled_payment_reminder',
      {
        p_occurrence_id: row.id,
        p_reminder_date: reminderDate,
        p_days_before_due: payment.reminder_days_before,
      },
    )

    if (claimError) {
      summary.failed += 1
      console.error(
        JSON.stringify({
          event: 'reminder_claim_error',
          occurrenceId: row.id,
          error: claimError.message,
        }),
      )
      continue
    }

    if (!claimed) {
      summary.skipped += 1
      continue
    }

    summary.claimed += 1

    let ownerEmail = emailCache.get(row.user_id)
    if (ownerEmail === undefined) {
      ownerEmail = await loadOwnerEmail(admin, row.user_id)
      emailCache.set(row.user_id, ownerEmail)
    }

    if (!ownerEmail) {
      await admin.rpc('complete_scheduled_payment_reminder', {
        p_delivery_id: claimed.id,
        p_status: 'failed',
        p_error: 'owner_email_unavailable',
      })
      summary.failed += 1
      console.error(
        JSON.stringify({
          event: 'reminder_email_unavailable',
          occurrenceId: row.id,
          deliveryId: claimed.id,
        }),
      )
      continue
    }

    const expectedAmount = parseAmount(row.expected_amount)
    const content = buildEmail({
      paymentName: payment.name,
      dueDate: row.due_date,
      expectedAmount,
      siteUrl,
    })

    const sendResult = await sendWithResend({
      to: ownerEmail,
      subject: content.subject,
      text: content.text,
    })

    if (sendResult.ok) {
      await admin.rpc('complete_scheduled_payment_reminder', {
        p_delivery_id: claimed.id,
        p_status: 'sent',
        p_error: null,
      })
      summary.sent += 1
      console.log(
        JSON.stringify({
          event: 'reminder_sent',
          occurrenceId: row.id,
          deliveryId: claimed.id,
          reminderDate,
        }),
      )
    } else {
      await admin.rpc('complete_scheduled_payment_reminder', {
        p_delivery_id: claimed.id,
        p_status: 'failed',
        p_error: sendResult.error,
      })
      summary.failed += 1
      console.error(
        JSON.stringify({
          event: 'reminder_send_failed',
          occurrenceId: row.id,
          deliveryId: claimed.id,
          error: sendResult.error,
        }),
      )
    }
  }

  return json(summary)
})
