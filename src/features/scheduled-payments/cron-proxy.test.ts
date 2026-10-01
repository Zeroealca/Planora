import { describe, expect, it, vi } from 'vitest'
import {
  authorizeVercelCron,
  buildRemindersProcessorUrl,
  invokeScheduledPaymentRemindersProcessor,
  resolveSupabaseUrl,
  runScheduledPaymentRemindersCron,
} from './cron-proxy'

describe('cron proxy authorization and URL', () => {
  it('rejects missing or incorrect Authorization bearer', () => {
    expect(authorizeVercelCron(undefined, 'secret')).toBe(false)
    expect(authorizeVercelCron('Bearer wrong', 'secret')).toBe(false)
    expect(authorizeVercelCron('Bearer secret', undefined)).toBe(false)
    expect(authorizeVercelCron('Bearer secret', '')).toBe(false)
    expect(authorizeVercelCron('Bearer secret', 'secret')).toBe(true)
  })

  it('resolves Supabase URL preferring SUPABASE_URL and builds the function path', () => {
    expect(resolveSupabaseUrl({ VITE_SUPABASE_URL: 'https://abc.supabase.co/' })).toBe(
      'https://abc.supabase.co',
    )
    expect(
      resolveSupabaseUrl({
        SUPABASE_URL: 'https://preferred.supabase.co',
        VITE_SUPABASE_URL: 'https://other.supabase.co',
      }),
    ).toBe('https://preferred.supabase.co')
    expect(buildRemindersProcessorUrl('https://abc.supabase.co')).toBe(
      'https://abc.supabase.co/functions/v1/process-scheduled-payment-reminders',
    )
  })
})

describe('runScheduledPaymentRemindersCron', () => {
  it('rejects unauthorized callers without invoking the processor', async () => {
    const fetchFn = vi.fn()
    const result = await runScheduledPaymentRemindersCron({
      authorizationHeader: 'Bearer nope',
      env: {
        CRON_SECRET: 'cron',
        REMINDER_JOB_SECRET: 'job',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
      },
      fetchFn,
    })
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ ok: false, error: 'unauthorized' })
    expect(JSON.stringify(result.body)).not.toMatch(/cron|job|secret/i)
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('invokes the processor with the reminder job secret header on success', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ sent: 1, failed: 0 }), { status: 200 }),
    )
    const result = await runScheduledPaymentRemindersCron({
      authorizationHeader: 'Bearer cron-secret',
      env: {
        CRON_SECRET: 'cron-secret',
        REMINDER_JOB_SECRET: 'job-secret',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
      },
      fetchFn,
    })

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true, processor: { sent: 1, failed: 0 } })
    expect(fetchFn).toHaveBeenCalledWith(
      'https://abc.supabase.co/functions/v1/process-scheduled-payment-reminders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-reminder-job-secret': 'job-secret',
        }),
      }),
    )
    expect(JSON.stringify(result.body)).not.toContain('job-secret')
    expect(JSON.stringify(result.body)).not.toContain('cron-secret')
  })

  it('propagates processor failures as non-2xx without leaking secrets', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'No autorizado.', REMINDER_JOB_SECRET: 'leaked' }), {
        status: 401,
      }),
    )
    const result = await invokeScheduledPaymentRemindersProcessor({
      supabaseUrl: 'https://abc.supabase.co',
      reminderJobSecret: 'job-secret',
      fetchFn,
    })

    expect(result.status).toBe(401)
    expect(result.body.ok).toBe(false)
    expect(JSON.stringify(result.body)).not.toContain('job-secret')
    expect(JSON.stringify(result.body)).not.toContain('leaked')
  })

  it('returns 502 when the processor is unreachable', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('network down'))
    const result = await runScheduledPaymentRemindersCron({
      authorizationHeader: 'Bearer cron-secret',
      env: {
        CRON_SECRET: 'cron-secret',
        REMINDER_JOB_SECRET: 'job-secret',
        VITE_SUPABASE_URL: 'https://abc.supabase.co',
      },
      fetchFn,
    })
    expect(result.status).toBe(502)
    expect(result.body).toEqual({ ok: false, error: 'processor_unreachable' })
  })
})
