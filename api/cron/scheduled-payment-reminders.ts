import {
  readAuthorizationHeader,
  runScheduledPaymentRemindersCron,
} from '../../src/features/scheduled-payments/cron-proxy'

type VercelRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
}

type VercelResponse = {
  status: (code: number) => VercelResponse
  json: (body: unknown) => void
}

/**
 * Vercel Cron entrypoint. Proxies to Supabase Edge Function only.
 * Schedule: 0 13 * * * (13:00 UTC ≈ 08:00 Ecuador continental).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  const result = await runScheduledPaymentRemindersCron({
    authorizationHeader: readAuthorizationHeader(req.headers),
    env: {
      CRON_SECRET: process.env.CRON_SECRET,
      REMINDER_JOB_SECRET: process.env.REMINDER_JOB_SECRET,
      SUPABASE_URL: process.env.SUPABASE_URL,
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
    },
  })

  res.status(result.status).json(result.body)
}
