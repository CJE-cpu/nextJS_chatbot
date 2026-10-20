'use client'

import { studyData } from '@/data/studyData'
import type { Studymode } from '@/types/study'
import { useRef, useState } from 'react'
import styles from './page.module.scss'

export default function StudyPage() {
  const [mode, setMode] = useState<Studymode>('explain')
  const [message, setMessage] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [showAnswer, setShowAnswer] = useState(false)
  const [previousQuestions, setPreviousQuestions] = useState<string[]>([])
  const [currentQuiz, setCurrentQuiz] = useState('')
  const [error, setError] = useState('')
  const lock = useRef(false)
  const topicRef = useRef<HTMLTextAreaElement>(null)

  function changeMode(next: Studymode) {
    setMode(next); setAnswer(''); setShowAnswer(false); setError('')
  }

  async function requestAnswer(reveal = false) {
    if (lock.current || (!reveal && !message.trim()) || (reveal && !currentQuiz)) return
    lock.current = true; setLoading(true); setError('')
    const prompts = {
      explain: '다음 학습 주제를 초보자에게 쉬운 예시와 함께 단계별로 설명해 줘.',
      quiz: '다음 학습 주제에 대한 짧은 주관식 퀴즈를 정확히 한 문제 만들어 줘. 문제만 출력하고 정답과 해설은 공개하지 마.',
      hint: '다음 질문의 정답을 직접 알려주지 말고 스스로 풀 수 있는 단계별 힌트를 줘.',
    }
    const question = reveal
      ? `다음 퀴즈의 정답과 해설을 알려줘. 사용자의 풀이가 있으면 검토해 줘.\n문제: ${currentQuiz.slice(0, 3200)}\n사용자 풀이: ${quizAnswer.trim() || '입력하지 않음'}`
      : `${prompts[mode]}\n${mode === 'hint' && currentQuiz ? `현재 퀴즈: ${currentQuiz.slice(0, 1400)}\n` : ''}학습 주제 또는 질문: ${message.trim()}`
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question }), signal: AbortSignal.timeout(55000) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '답변 요청에 실패했습니다.')
      if (typeof data.answer !== 'string' || !data.answer.trim()) throw new Error('답변을 받지 못했습니다.')
      if (reveal) { setAnswer(data.answer); setShowAnswer(true) }
      else {
        setAnswer(mode === 'quiz' ? '' : data.answer)
        if (mode === 'quiz') { setCurrentQuiz(data.answer); setQuizAnswer('') }
        else if (mode === 'explain') setCurrentQuiz('')
        setShowAnswer(false)
        setPreviousQuestions(previous => [message.trim(), ...previous.filter(item => item !== message.trim())].slice(0, 5))
      }
    } catch (err) { setError(err instanceof Error ? err.message : '답변을 가져오지 못했습니다.') }
    finally { lock.current = false; setLoading(false) }
  }

  return <main id="main-content" tabIndex={-1} className={styles.page}>
    <header className="serviceIntro"><p>LEARN AT YOUR OWN PACE</p><h1>알아가는 즐거움, AI 학습</h1><span>이해가 필요한 순간부터 혼자 풀어 보고 싶은 문제까지.<br />나에게 맞는 방법으로 차근차근 공부해 보세요.</span></header>
    <section aria-labelledby="study-mode"><h2 id="study-mode">어떻게 공부해 볼까요?</h2><div className={styles.modes}>{studyData.map(item => <button type="button" key={item.id} aria-pressed={mode === item.mode} disabled={loading} onClick={() => changeMode(item.mode)} className={mode === item.mode ? styles.selected : ''}><span className={styles.modeNumber}>0{item.id}</span><h3>{item.title}</h3><p>{item.description}</p></button>)}</div></section>
    <form className={styles.form} onSubmit={event => { event.preventDefault(); void requestAnswer() }}>
      <label htmlFor="study-question">어떤 내용을 공부하고 싶나요?</label><textarea ref={topicRef} id="study-question" maxLength={4000} value={message} onChange={event => { setMessage(event.target.value); setCurrentQuiz(''); setAnswer(''); setShowAnswer(false) }} disabled={loading} placeholder="예: JavaScript의 변수와 상수는 어떤 차이가 있나요?" required />
      <div className={styles.actions}><small>{message.length.toLocaleString()} / 4,000</small><button disabled={loading || !message.trim()}>{loading ? '답변을 준비하고 있어요…' : mode === 'quiz' ? '새 퀴즈 만들기 ↗' : mode === 'hint' ? '힌트 받기 ↗' : '개념 알아보기 ↗'}</button></div>
    </form>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <div aria-live="polite" aria-busy={loading}>
      {currentQuiz && <section className={styles.result}><h2>직접 풀어 볼까요?</h2><p>{currentQuiz}</p><label htmlFor="quiz-answer">나의 풀이 (선택)</label><textarea id="quiz-answer" maxLength={1500} value={quizAnswer} onChange={event => setQuizAnswer(event.target.value)} disabled={loading || showAnswer} placeholder="떠오르는 답을 적어 보세요." />{!showAnswer && <button type="button" disabled={loading} onClick={() => void requestAnswer(true)}>정답과 해설 확인</button>}</section>}
      {answer && <section className={styles.result}><h2>{showAnswer ? '정답과 해설' : mode === 'hint' ? '생각을 돕는 힌트' : '차근차근 개념 설명'}</h2><p>{answer}</p></section>}
    </div>
    {!!previousQuestions.length && <section className={styles.history}><h2>최근 공부한 주제</h2><p>다시 공부하고 싶은 주제를 선택해 보세요.</p>{previousQuestions.map(item => <button key={item} disabled={loading} onClick={() => { setMessage(item); setCurrentQuiz(''); setAnswer(''); setShowAnswer(false); topicRef.current?.focus() }}>{item} ↗</button>)}</section>}
    <p className={styles.note}>AI의 설명과 정답은 틀릴 수 있어요. 교재와 함께 확인해 주세요.</p>
  </main>
}
