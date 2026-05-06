import type { Context } from '@netlify/functions'

type RatingValue = 'none' | 'mild' | 'moderate' | 'severe' | ''

interface Submission {
  patient_name?: string
  dob?: string
  height_cm?: string
  weight_kg?: string
  reason_for_visit?: Record<string, unknown>
  medical_history_safety?: Record<string, unknown>
  allergies?: {
    has_allergies?: string
    allergy1?: { medication?: string; reaction?: string }
    allergy2?: { medication?: string; reaction?: string }
  }
  other_conditions?: string
  current_medications?: string
  menstrual_reproductive?: Record<string, unknown>
  pregnancy_history?: Record<string, unknown>
  screening?: Record<string, unknown>
  family_history?: Record<string, unknown>
  lifestyle?: Record<string, unknown>
  weight_management_safety?: Record<string, unknown>
  relationship_safety?: Record<string, unknown>
  menopause_symptoms?: Record<string, RatingValue>
  menopause_management?: Record<string, unknown>
}

const reasonLabels: Record<string, string> = {
  menopause: 'Menopause/Perimenopause symptoms',
  weight_management: 'Weight management',
  contraception: 'Contraception advice',
  periods: 'Period concerns',
  sexual_health: 'Sexual health concerns',
  bladder: 'Bladder problems',
  breast: 'Breast concerns',
  mental_health: 'Mental health concerns',
}

const historyLabels: Record<string, string> = {
  breast_cancer: 'Breast cancer',
  blood_clot: 'Blood clot (DVT or pulmonary embolism)',
  heart_stroke: 'Heart attack or stroke',
  liver_disease: 'Liver disease',
  endometrial_cancer: 'Endometrial cancer or hyperplasia',
  ovarian_cancer: 'Ovarian cancer',
  melanoma: 'Melanoma',
  vaginal_bleeding: 'Current unexplained vaginal bleeding',
}

const concernLabels: Record<string, string> = {
  bleeding_outside: 'Bleeding outside periods',
  pain_with_sex: 'Bleeding/pain with intercourse',
  painful_periods: 'Painful periods',
  heavy_periods: 'Heavy periods',
  prolonged_periods: 'Prolonged periods',
}

const familyHistoryLabels: Record<string, string> = {
  breast_cancer: 'Breast cancer',
  ovarian_cancer: 'Ovarian cancer',
  heart_attack: 'Heart attack (before age 60)',
  stroke: 'Stroke (before age 60)',
  blood_clots: 'Blood clots',
  diabetes: 'Diabetes',
}

const weightSafetyLabels: Record<string, string> = {
  pancreatitis: 'Pancreatitis',
  gallbladder: 'Gallbladder disease (gallstones or removal)',
  thyroid_cancer: 'Medullary thyroid cancer (you or family)',
  men2: 'MEN2 (Multiple Endocrine Neoplasia type 2)',
}

const symptomLabels: Record<string, string> = {
  hot_flushes: 'Hot flushes / night sweats',
  irritability: 'Irritability',
  depression: 'Low mood / depression',
  anxiety: 'Anxiety',
  mood_swings: 'Mood swings',
  sleep: 'Poor sleep / insomnia',
  fatigue: 'Fatigue',
  libido: 'Reduced sexual desire',
  vaginal_dryness: 'Vaginal dryness',
  painful_sex: 'Painful intercourse',
}

const periodStatusLabels: Record<string, string> = {
  regular: 'Yes, regular periods',
  irregular: 'Yes, irregular periods',
  stopped: 'No, periods have stopped',
  na: 'Not applicable (hysterectomy/IUD)',
}

const exerciseLabels: Record<string, string> = {
  daily: 'Daily',
  several: 'Several times per week',
  occasional: 'Occasionally',
  rarely: 'Rarely / never',
}

const alcoholLabels: Record<string, string> = {
  regular: 'Yes, regularly',
  occasional: 'Occasionally',
  no: 'No',
}

const yesNoLabels: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  prefer_not: 'Prefer not to answer',
  not_now: 'Not at this time',
  na: 'Not applicable',
}

const cervicalLabels: Record<string, string> = {
  normal: 'Normal',
  abnormal: 'Abnormal',
  unsure: 'Unsure',
}

const ratingLabels: Record<string, string> = {
  none: 'None',
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const formatValue = (value: unknown, fallback = '—'): string => {
  if (value === undefined || value === null) return fallback
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? fallback : escapeHtml(trimmed).replace(/\n/g, '<br>')
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return escapeHtml(String(value))
}

const lookup = (map: Record<string, string>, key: string | undefined): string => {
  if (!key) return '—'
  return map[key] ?? escapeHtml(key)
}

const checkedItems = (
  source: Record<string, unknown> | undefined,
  labels: Record<string, string>,
): string => {
  if (!source) return '—'
  const items = Object.entries(labels)
    .filter(([key]) => source[key] === true)
    .map(([, label]) => label)
  if (source.none === true && items.length === 0) return 'None of the above'
  return items.length > 0 ? items.join(', ') : '—'
}

interface Row {
  question: string
  answer: string
}

const renderSection = (title: string, rows: Row[]): string => {
  const tableRows = rows
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#f7fafc;font-weight:600;color:#2d3748;width:42%;vertical-align:top;">${escapeHtml(
            row.question,
          )}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#1a202c;vertical-align:top;">${row.answer}</td>
        </tr>`,
    )
    .join('')

  return `
    <h2 style="font-size:18px;color:#2d3748;margin:32px 0 12px;padding-bottom:6px;border-bottom:3px solid #319795;">${escapeHtml(
      title,
    )}</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${tableRows}</table>
  `
}

const buildHtml = (data: Submission, submittedAt: string): string => {
  const reason = data.reason_for_visit ?? {}
  const reasons = checkedItems(reason, reasonLabels)
  const otherReason =
    reason.other_checked === true && typeof reason.other_text === 'string' && reason.other_text.trim() !== ''
      ? reason.other_text
      : ''

  const history = data.medical_history_safety ?? {}
  const historyConditions = checkedItems(history, historyLabels)

  const allergies = data.allergies ?? {}
  const allergyRows: Row[] = [
    { question: 'Has allergies?', answer: lookup(yesNoLabels, allergies.has_allergies) },
  ]
  if (allergies.allergy1?.medication || allergies.allergy1?.reaction) {
    allergyRows.push({
      question: 'Allergy 1',
      answer: `${formatValue(allergies.allergy1?.medication)} — Reaction: ${formatValue(
        allergies.allergy1?.reaction,
      )}`,
    })
  }
  if (allergies.allergy2?.medication || allergies.allergy2?.reaction) {
    allergyRows.push({
      question: 'Allergy 2',
      answer: `${formatValue(allergies.allergy2?.medication)} — Reaction: ${formatValue(
        allergies.allergy2?.reaction,
      )}`,
    })
  }

  const menstrual = data.menstrual_reproductive ?? {}
  const concerns = checkedItems(
    menstrual.concerns as Record<string, unknown> | undefined,
    concernLabels,
  )

  const pregnancy = data.pregnancy_history ?? {}
  const screening = data.screening ?? {}
  const family = data.family_history ?? {}
  const familyConditions = checkedItems(family, familyHistoryLabels)
  const lifestyle = data.lifestyle ?? {}
  const weightSafety = data.weight_management_safety ?? {}
  const weightSafetyConditions = checkedItems(weightSafety, weightSafetyLabels)
  const safety = data.relationship_safety ?? {}
  const symptoms = data.menopause_symptoms ?? {}
  const management = data.menopause_management ?? {}

  const sections: string[] = []

  sections.push(
    renderSection('Personal Information', [
      { question: 'Full name', answer: formatValue(data.patient_name) },
      { question: 'Date of birth', answer: formatValue(data.dob) },
      { question: 'Height (cm)', answer: formatValue(data.height_cm) },
      { question: 'Weight (kg)', answer: formatValue(data.weight_kg) },
    ]),
  )

  sections.push(
    renderSection('Reason for Consultation', [
      { question: 'Reasons for visit', answer: escapeHtml(reasons) },
      ...(otherReason ? [{ question: 'Other reason (specified)', answer: formatValue(otherReason) }] : []),
    ]),
  )

  sections.push(
    renderSection('Medical History — Safety Conditions', [
      {
        question: 'Conditions ever diagnosed',
        answer: escapeHtml(historyConditions),
      },
      { question: 'Year(s) diagnosed / details', answer: formatValue(history.details) },
    ]),
  )

  sections.push(renderSection('Allergies', allergyRows))

  sections.push(
    renderSection('Other Medical Conditions & Medications', [
      { question: 'Other significant medical conditions', answer: formatValue(data.other_conditions) },
      { question: 'Current medications (incl. supplements)', answer: formatValue(data.current_medications) },
    ]),
  )

  sections.push(
    renderSection('Menstrual & Reproductive History', [
      { question: 'Currently having periods?', answer: lookup(periodStatusLabels, menstrual.period_status as string) },
      { question: 'If stopped, when?', answer: formatValue(menstrual.periods_stopped_when) },
      { question: 'Menstrual concerns', answer: escapeHtml(concerns) },
      { question: 'Additional menstrual details', answer: formatValue(menstrual.additional_details) },
      { question: 'Currently using contraception?', answer: lookup(yesNoLabels, menstrual.using_contraception as string) },
      { question: 'Contraception method', answer: formatValue(menstrual.contraception_method) },
    ]),
  )

  sections.push(
    renderSection('Pregnancy History', [
      { question: 'Number of pregnancies', answer: formatValue(pregnancy.num_pregnancies) },
      { question: 'Vaginal births', answer: formatValue(pregnancy.num_vaginal) },
      { question: 'Caesarean births', answer: formatValue(pregnancy.num_caesarean) },
      { question: 'Number of miscarriages', answer: formatValue(pregnancy.num_miscarriages) },
      { question: 'Pregnancy complications', answer: formatValue(pregnancy.complications) },
    ]),
  )

  sections.push(
    renderSection('Preventative Health Screening', [
      { question: 'Last cervical screening (year)', answer: formatValue(screening.cervical_year) },
      { question: 'Cervical screening result', answer: lookup(cervicalLabels, screening.cervical_result as string) },
      { question: 'Last mammogram (year)', answer: formatValue(screening.mammogram_year) },
      { question: 'Last bone density scan (year)', answer: formatValue(screening.bone_density_year) },
    ]),
  )

  sections.push(
    renderSection('Family History', [
      { question: 'Conditions in blood relatives', answer: escapeHtml(familyConditions) },
      { question: 'Affected relatives / details', answer: formatValue(family.details) },
    ]),
  )

  sections.push(
    renderSection('Lifestyle', [
      { question: 'Currently smokes or vapes?', answer: lookup(yesNoLabels, lifestyle.current_smoke as string) },
      { question: 'Smoked or vaped in the past?', answer: lookup(yesNoLabels, lifestyle.past_smoke as string) },
      { question: 'Alcohol use', answer: lookup(alcoholLabels, lifestyle.alcohol_use as string) },
      { question: 'Exercise frequency', answer: lookup(exerciseLabels, lifestyle.exercise_frequency as string) },
    ]),
  )

  if (reason.weight_management === true) {
    sections.push(
      renderSection('Weight Management Safety Screening', [
        { question: 'Relevant conditions ever had', answer: escapeHtml(weightSafetyConditions) },
      ]),
    )
  }

  sections.push(
    renderSection('Relationship & Safety', [
      {
        question: 'Currently afraid for safety in relationship?',
        answer: lookup(yesNoLabels, safety.current_afraid as string),
      },
      {
        question: 'Currently experiencing verbal/physical/financial abuse?',
        answer: lookup(yesNoLabels, safety.current_abuse as string),
      },
      {
        question: 'Ever afraid for safety in past relationship?',
        answer: lookup(yesNoLabels, safety.past_afraid as string),
      },
      {
        question: 'Past verbal/physical/financial abuse?',
        answer: lookup(yesNoLabels, safety.past_abuse as string),
      },
      { question: 'History of childhood trauma?', answer: lookup(yesNoLabels, safety.childhood_trauma as string) },
      { question: 'Wants help/support for safety issues?', answer: lookup(yesNoLabels, safety.wants_help as string) },
    ]),
  )

  const symptomRows: Row[] = Object.entries(symptomLabels).map(([key, label]) => ({
    question: label,
    answer: lookup(ratingLabels, symptoms[key] as string),
  }))
  sections.push(renderSection('Menopause Symptom Severity', symptomRows))

  sections.push(
    renderSection('Current Menopause Management', [
      { question: 'Currently taking HRT/menopause medication?', answer: lookup(yesNoLabels, management.taking_hrt as string) },
      { question: 'HRT medications & doses', answer: formatValue(management.hrt_details) },
      { question: 'Other approaches used', answer: formatValue(management.other_management) },
    ]),
  )

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a202c;">
    <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,0.08);">
      <div style="background:#E8F4F5;border-bottom:4px solid #319795;padding:28px 32px;">
        <div style="font-size:22px;font-weight:700;color:#2d3748;">PauseSleep — Women's Health Questionnaire</div>
        <div style="font-size:14px;color:#4a5568;margin-top:4px;">Modern Medical Balwyn · Dr Premila Hewage</div>
        <div style="font-size:13px;color:#718096;margin-top:10px;">
          <strong>Patient:</strong> ${formatValue(data.patient_name)} &nbsp;·&nbsp;
          <strong>DOB:</strong> ${formatValue(data.dob)} &nbsp;·&nbsp;
          <strong>Submitted:</strong> ${escapeHtml(submittedAt)}
        </div>
      </div>
      <div style="padding:8px 32px 32px;">
        ${sections.join('\n')}
      </div>
    </div>
  </body>
</html>`
}

const buildText = (data: Submission, submittedAt: string): string => {
  const lines: string[] = []
  lines.push("PauseSleep — Women's Health Questionnaire")
  lines.push('Modern Medical Balwyn · Dr Premila Hewage')
  lines.push('')
  lines.push(`Patient: ${data.patient_name ?? '-'}`)
  lines.push(`DOB: ${data.dob ?? '-'}`)
  lines.push(`Submitted: ${submittedAt}`)
  lines.push('')
  lines.push('See HTML version for full formatted answer sheet.')
  return lines.join('\n')
}

export default async (req: Request, _context: Context) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let data: Submission
  try {
    data = (await req.json()) as Submission
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const recipient = Netlify.env.get('DOCTOR_EMAIL')
  const apiKey = Netlify.env.get('RESEND_API_KEY')
  const fromAddress = Netlify.env.get('FORM_FROM_EMAIL') ?? 'PauseSleep Form <onboarding@resend.dev>'

  if (!recipient || !apiKey) {
    return Response.json(
      {
        error:
          'Email is not configured. Set DOCTOR_EMAIL and RESEND_API_KEY environment variables in the Netlify site settings.',
      },
      { status: 500 },
    )
  }

  const submittedAt = new Date().toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const html = buildHtml(data, submittedAt)
  const text = buildText(data, submittedAt)
  const patientName = data.patient_name?.trim() || 'New patient'
  const subject = `New Women's Health Questionnaire — ${patientName}`

  const emailResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress,
      to: recipient.split(',').map((value) => value.trim()).filter(Boolean),
      subject,
      html,
      text,
    }),
  })

  if (!emailResponse.ok) {
    const errBody = await emailResponse.text()
    return Response.json(
      { error: 'Failed to send email', detail: errBody },
      { status: 502 },
    )
  }

  return Response.json({ ok: true })
}

export const config = {
  path: '/api/submit-form',
}
