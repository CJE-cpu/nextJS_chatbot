type Message = { role: 'user' | 'assistant'; content: string }
type Output = { type?: string; content?: { type?: string; text?: string; refusal?: string }[] }

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
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'AI 서비스 연결을 준비 중입니다. 운영자가 API 키를 설정하면 대화할 수 있습니다.' }, { status: 503 })
  }
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4.1-mini', instructions,
        input, store: false, max_output_tokens: 1800 }),
      signal: AbortSignal.timeout(45000),
    })
    if (!response.ok) {
      return Response.json({ error: response.status === 429
        ? '현재 요청이 많거나 서비스 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.'
        : 'AI 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: response.status === 429 ? 429 : 502 })
    }
    const data = await response.json() as { output?: Output[] }
    const answer = data.output?.filter(item => item.type === 'message').flatMap(item => item.content || [])
      .map(item => item.type === 'output_text' ? item.text || '' : item.refusal || '').join('\n').trim()
    if (!answer) return Response.json({ error: '답변을 생성하지 못했습니다. 다시 질문해 주세요.' }, { status: 502 })
    return Response.json({ answer })
  } catch {
    return Response.json({ error: '응답 시간이 초과되었거나 연결이 끊어졌습니다. 다시 시도해 주세요.' }, { status: 504 })
  }
}
