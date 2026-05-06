import type { Context } from '@netlify/functions'

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '<em>—</em>'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (Array.isArray(value)) {
    return value.length === 0 ? '<em>—</em>' : value.map(renderValue).join(', ')
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) return '<em>—</em>'
    return (
      '<table style="border-collapse:collapse;margin:4px 0;width:100%;">' +
      entries
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;border:1px solid #e2e8f0;background:#f7fafc;font-weight:600;vertical-align:top;">${escapeHtml(k)}</td><td style="padding:4px 8px;border:1px solid #e2e8f0;vertical-align:top;">${renderValue(v)}</td></tr>`,
        )
        .join('') +
      '</table>'
    )
  }
  return escapeHtml(String(value))
}

const buildHtml = (data: Record<string, unknown>) => {
  const sections = Object.entries(data)
    .map(
      ([key, value]) =>
        `<h2 style="font-size:16px;margin:20px 0 6px;color:#2d3748;border-bottom:2px solid #319795;padding-bottom:4px;">${escapeHtml(key)}</h2>${renderValue(value)}`,
    )
    .join('')
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;max-width:720px;">${sections}</div>`
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  const apiKey = Netlify.env.get('RESEND_API_KEY')
  const doctorEmail = Netlify.env.get('DOCTOR_EMAIL')
  const fromAddress = Netlify.env.get('FROM_EMAIL') || 'PauseSleep Form <onboarding@resend.dev>'

  if (!apiKey || !doctorEmail) {
    return Response.json(
      { error: 'Server is not configured. RESEND_API_KEY and DOCTOR_EMAIL must be set.' },
      { status: 500 },
    )
  }

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const patientName =
    typeof data.patient_name === 'string' && data.patient_name.trim()
      ? data.patient_name.trim()
      : 'New patient'

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [doctorEmail],
      subject: `New Women's Health Questionnaire — ${patientName}`,
      html: buildHtml(data),
    }),
  })

  if (!resendResponse.ok) {
    const detail = await resendResponse.text()
    console.error('Resend API error:', resendResponse.status, detail)
    return Response.json(
      { error: 'Failed to send submission email.', status: resendResponse.status },
      { status: 502 },
    )
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/submit-form',
  method: 'POST',
}
