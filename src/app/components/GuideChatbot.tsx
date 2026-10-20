'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import styles from './GuideChatbot.module.scss'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export default function GuideChatbot() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState<ChatMessage[]>([
    { role: 'assistant', content: '안녕하세요! 홈페이지 이용 방법을 안내해 드립니다' },
  ])
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState('')
  const messageRef = useRef<HTMLDivElement | null>(null)
  const sendingRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); toggleRef.current?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])

  useEffect(() => {
    if (messageRef.current) {
      messageRef.current.scrollTop = messageRef.current.scrollHeight
    }
  }, [message, loading, open])

  const handleSend = async () => {
    if (!question.trim() || sendingRef.current) return
    const userMessage: ChatMessage = { role: 'user', content: question.trim() }
    sendingRef.current = true
    setMessage(previous => [...previous, userMessage])
    setQuestion('')
    setLoading(true)

    try {
      const response = await fetch('/api/guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...message, userMessage].slice(-23) }),
        signal: AbortSignal.timeout(55000),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || data.message || '답변 요청 실패')
      }
      setMessage(previous => [...previous, {
        role: 'assistant',
        content: typeof data.answer === 'string' && data.answer.trim()
          ? data.answer : '답변을 생성하지 못했습니다',
      }])
    } catch (error) {
      console.error('가이드 챗봇 오류', error)
      setMessage(previous => [...previous, {
        role: 'assistant', content: error instanceof Error ? error.message : '오류가 발생했습니다. 다시 질문해 주세요.',
      }])
    } finally {
      sendingRef.current = false
      setLoading(false)
    }
  }

  return (
    <aside className={styles.chatbot} aria-label="홈페이지 가이드 챗봇">
      {open && (
        <section id="guide-chatbot-panel" className={styles.panel}>
          <div className={styles.header}>
            <h3><span aria-hidden="true">✳ </span>모아 이용 도우미</h3>
            <button type="button" onClick={() => setOpen(false)} aria-label="챗봇 닫기">X</button>
          </div>
          <nav className={styles.shortcuts} aria-label="서비스 바로가기"><Link href="/study" onClick={() => setOpen(false)}>AI 학습 ↗</Link><Link href="/weather" onClick={() => setOpen(false)}>날씨 ↗</Link><Link href="/chart" onClick={() => setOpen(false)}>대화 활동 ↗</Link></nav>
          <div className={styles.messages} ref={messageRef} role="log" aria-live="polite">
            {message.map((item, index) => (
              <p key={index} className={item.role === 'user' ? styles.userMessage : styles.answer}>
                {item.content}
              </p>
            ))}
            {loading && <p className={styles.answer}>답변을 기다리는 중입니다…</p>}
          </div>
          <form className={styles.inputBox} onSubmit={event => {
            event.preventDefault()
            void handleSend()
          }}>
            <input ref={inputRef} maxLength={2000} type="text" aria-label="가이드 질문" placeholder="이용 방법을 물어보세요"
              value={question} onChange={event => setQuestion(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault()
              }} disabled={loading} />
            <button type="submit" disabled={loading || !question.trim()}>{loading ? '대기중' : '전송'}</button>
          </form>
        </section>
      )}
      <button ref={toggleRef} type="button" className={styles.toggle} onClick={() => setOpen(previous => !previous)}
        aria-expanded={open} aria-controls="guide-chatbot-panel" aria-label={open ? '챗봇 닫기' : '챗봇 열기'}>
        {open ? '×' : '✳'}
      </button>
    </aside>
  )
}
