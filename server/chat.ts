type Message = { role: 'user' | 'assistant'; content: string }
type Output = { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }

export function chatConfiguration() {
  const provider = process.env.AI_PROVIDER?.trim() || 'gemini'
  const apiKey = provider === 'gemini' ? process.env.GEMINI_API_KEY?.trim()
    : provider === 'openai' ? process.env.OPENAI_API_KEY?.trim() : undefined
  return { provider, apiKey }
}

export function chatStatus() {
  const { provider, apiKey } = chatConfiguration()
  return { provider, configured: Boolean(apiKey) }
}

export async function reply(request: Request, instructions: string) {
  let body: unknown
  try { body = await request.json() } catch {
    return Response.json({ error: '올바른 JSON 요청을 보내 주세요.' }, { status: 400 })
  }
  if (!body || typeof body !== 'object') {
    return Response.json({ error: '질문을 입력해 주세요.' }, { status: 400 })
  }
  const payload = body as Record<string, unknown>
  const input = Array.isArray(payload.messages) ? payload.messages
    : typeof payload.question === 'string' ? [{ role: 'user', content: payload.question }] : []
  if (!input.length || input.length > 24 || !input.every((item): item is Message =>
    !!item && typeof item === 'object' && (item.role === 'user' || item.role === 'assistant') &&
    typeof item.content === 'string' && !!item.content.trim() && item.content.length <= 6000
  ) || input[input.length - 1].role !== 'user') {
    return Response.json({ error: '질문은 1~6,000자, 대화는 최대 24개 메시지로 보내 주세요.' }, { status: 400 })
  }
  const { provider, apiKey } = chatConfiguration()
  if (!apiKey) {
    return Response.json({ error: 'AI 서비스 연결을 준비 중입니다. 운영자가 API 키를 설정하면 대화할 수 있습니다.' }, { status: 503 })
  }
  try {
    const gemini = provider === 'gemini'
    const endpoint = gemini
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.openai.com/v1/responses'
    const payload = gemini
      ? { model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite',
          messages: [{ role: 'system', content: instructions }, ...input],
          max_tokens: 1800, reasoning_effort: 'minimal' }
      : { model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', instructions,
          input, store: false, max_output_tokens: 1800 }
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(45000),
    })
    if (!response.ok) {
      if (gemini && response.status === 429) {
        return Response.json({
          error: 'AI 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 일일 한도에 도달한 경우 한도가 초기화될 때까지 기다려야 합니다.',
          code: 'rate_limit_exceeded',
        }, { status: 429 })
      }
      if (response.status === 401 || response.status === 403) {
        return Response.json({ error: 'AI 서비스 인증 설정을 확인해야 합니다. 운영자가 API 키와 접근 권한을 확인해 주세요.' }, { status: 503 })
      }
      if (response.status === 429) {
        const body: unknown = await response.json().catch(() => null)
        const detail = body && typeof body === 'object' && 'error' in body ? body.error : null
        const code = detail && typeof detail === 'object' && 'code' in detail ? detail.code : null
        const type = detail && typeof detail === 'object' && 'type' in detail ? detail.type : null
        const billingErrors: Record<string, string> = {
          credit_balance_exhausted: 'AI 서비스의 API 잔액이 부족합니다. 운영자가 OpenAI 결제 설정에서 크레딧을 확인해야 합니다.',
          organization_spend_limit_exceeded: 'AI 서비스의 조직 지출 한도에 도달했습니다. 운영자의 한도 확인이 필요합니다.',
          project_spend_limit_exceeded: 'AI 서비스의 프로젝트 지출 한도에 도달했습니다. 운영자의 한도 확인이 필요합니다.',
          organization_usage_limit_exceeded: 'AI 서비스의 조직 사용 한도에 도달했습니다. 운영자의 사용 한도 확인이 필요합니다.',
          insufficient_quota: 'AI 서비스의 API 크레딧 또는 사용 한도가 부족합니다. 운영자가 OpenAI 결제 및 사용 한도를 확인해야 합니다.',
        }
        const knownCode = typeof code === 'string' && Object.hasOwn(billingErrors, code) ? code : null
        const quotaError = knownCode || (type === 'insufficient_quota' && code !== 'rate_limit_exceeded' && code !== 'slow_down' ? 'insufficient_quota' : null)
        return Response.json({
          error: quotaError ? billingErrors[quotaError] : 'AI 요청 제한에 도달했습니다. 잠시 기다린 뒤 다시 시도해 주세요.',
          code: quotaError || 'rate_limit_exceeded',
        }, { status: 429 })
      }
      return Response.json({ error: 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 })
    }
    const data = await response.json() as { output?: Output[]; choices?: { message?: { content?: string } }[] }
    const answer = gemini ? data.choices?.[0]?.message?.content?.trim() : data.output?.filter(item => item.type === 'message').flatMap(item => item.content || [])
      .map(item => item.type === 'output_text' ? item.text || '' : item.refusal || '').join('\n').trim()
    if (!answer) return Response.json({ error: '답변을 생성하지 못했습니다. 다시 질문해 주세요.' }, { status: 502 })
    return Response.json({ answer })
  } catch {
    return Response.json({ error: '응답 시간이 초과되었거나 연결이 끊어졌습니다. 다시 시도해 주세요.' }, { status: 504 })
  }
}
