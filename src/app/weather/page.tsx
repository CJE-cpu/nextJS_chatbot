'use client'

import { useRef, useState } from 'react'
import type { WeatherData } from '@/types/weather'
import styles from './page.module.scss'

export default function WeatherPage() {
  const [city, setCity] = useState('')
  const [loading, setLoading] = useState(false)
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [error, setError] = useState('')
  const lock = useRef(false)

  async function search(value = city) {
    if (!value.trim() || lock.current) return
    lock.current = true; setLoading(true); setError(''); setCity(value)
    try {
      const response = await fetch(`/api/weather?city=${encodeURIComponent(value.trim())}`, { signal: AbortSignal.timeout(20000) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || '날씨 정보를 가져오지 못했습니다.')
      setWeather(data)
    } catch (err) { setError(err instanceof Error ? err.message : '연결을 확인한 뒤 다시 시도해 주세요.'); setWeather(null) }
    finally { lock.current = false; setLoading(false) }
  }

  return <main id="main-content" tabIndex={-1} className="servicePage"><header className="serviceIntro"><p>A LITTLE CHECK BEFORE YOU GO</p><h1>오늘, 어떤 날씨인가요?</h1><span>외출 전 가볍게 확인하는 도시의 현재 날씨.<br />도시 이름을 입력해 기온과 습도, 바람을 알아보세요.</span></header>
    <section className="serviceCard" aria-label="도시 날씨 검색"><form className={styles.searchBox} onSubmit={event => { event.preventDefault(); void search() }}><label htmlFor="weather-city">도시 이름</label><div><input id="weather-city" value={city} maxLength={100} onChange={event => setCity(event.target.value)} placeholder="예: Seoul, Busan, Tokyo" required disabled={loading} /><button disabled={loading || !city.trim()}>{loading ? '확인 중…' : '날씨 확인 ↗'}</button></div></form><div className={styles.cities}><span>빠른 검색</span>{['Seoul', 'Busan', 'Tokyo', 'London'].map(item => <button key={item} disabled={loading} onClick={() => void search(item)}>{item}</button>)}</div></section>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div aria-live="polite" aria-busy={loading}>{weather ? <section className={styles.weather}><div className={styles.weatherHead}><span>현재 날씨</span><span>OPENWEATHER</span></div><div className={styles.overview}><div><h2>{weather.name}</h2><p>{weather.weather[0]?.description || '날씨 정보'}</p><strong>{Math.round(weather.main.temp)}<small>°C</small></strong></div><span className={styles.weatherIcon} aria-hidden="true">{weather.weather[0]?.main === 'Rain' ? '☂' : weather.weather[0]?.main === 'Clear' ? '☀' : '☁'}</span></div><div className={styles.metrics}><div><span>습도</span><strong>{weather.main.humidity}<small> %</small></strong></div><div><span>풍속</span><strong>{weather.wind.speed}<small> m/s</small></strong></div></div></section> : !error && <section className={styles.empty}><span>☁</span><h2>궁금한 도시가 있나요?</h2><p>도시를 검색하면 이곳에 현재 날씨가 표시돼요.</p></section>}</div><p className="serviceNote">OpenWeather에서 제공하는 현재 관측 정보입니다. 도시 이름을 찾지 못하면 영문으로 입력해 보세요.</p></main>
}
