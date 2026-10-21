import { reply, chatStatus } from '../../../../server/chat'

export const runtime = 'nodejs'
export const maxDuration = 60

export function GET() {
  return Response.json(chatStatus(), { headers: { 'Cache-Control': 'no-store' } })
}

export function POST(request: Request) {
  return reply(request, '너는 모아 AI라는 친절한 한국어 AI 도우미다. 글쓰기, 학습, 코딩, 아이디어 정리와 일상 질문을 돕는다. 사용자의 언어에 맞추어 구체적이고 명료하게 답한다. 모르는 사실은 솔직히 설명하고 실시간 검색 기능이 있다고 주장하지 않는다.')
}
