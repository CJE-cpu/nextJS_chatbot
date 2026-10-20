export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')?.trim()
  if (!city || city.length > 100) return Response.json({ message: '도시 이름을 1~100자로 입력해 주세요.' }, { status: 400 })
  const apiKey = process.env.OPENWEATHER_API_KEY
  if (!apiKey) return Response.json({ message: '날씨 서비스 연결을 준비 중입니다. 운영자의 서비스 설정이 필요합니다.' }, { status: 503 })
  try {
    const url = new URL('https://api.openweathermap.org/data/2.5/weather')
    url.search = new URLSearchParams({ q: city, appid: apiKey, units: 'metric', lang: 'kr' }).toString()
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!response.ok) {
      if (response.status === 404) return Response.json({ message: '도시를 찾지 못했습니다. 영문 도시 이름으로 다시 검색해 보세요.' }, { status: 404 })
      return Response.json({ message: response.status === 429 ? '요청이 많습니다. 잠시 후 다시 검색해 주세요.' : '날씨 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: response.status === 429 ? 429 : 502 })
    }
    return Response.json(await response.json())
  } catch { return Response.json({ message: '날씨 응답을 받지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.' }, { status: 504 }) }
}
