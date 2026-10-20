'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { CHAT_STORAGE_KEY, readConversations, type Conversation, type Message } from '@/data/conversations'
import styles from './page.module.scss'

const suggestions = [
  { icon: '✎', title: '글쓰기 도우미', text: '생각을 자연스러운 문장으로', prompt: '정중하고 간결한 업무 이메일을 쓰는 방법을 예시와 함께 알려줘.', color: 'purple' },
  { icon: '⌘', title: '코딩 파트너', text: '막힌 코드에 새로운 실마리를', prompt: 'JavaScript의 async와 await를 초보자도 이해할 수 있게 설명해줘.', color: 'blue' },
  { icon: '☀', title: '아이디어 메이트', text: '작은 영감을 더 큰 가능성으로', prompt: '집에서 시작할 수 있는 창의적인 취미 아이디어 5가지를 제안해줘.', color: 'orange' },
  { icon: '▤', title: '학습 길잡이', text: '어려운 개념도 차근차근', prompt: '영어 회화를 처음 시작하는 사람을 위한 일주일 학습 계획을 만들어줘.', color: 'green' },
]

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([{ id: 1, title: '새로운 대화', messages: [] }])
  const [activeId, setActiveId] = useState(1)
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [help, setHelp] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [restored, setRestored] = useState(false)
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const active = conversations.find(item => item.id === activeId)!

  useEffect(() => {
    let mounted = true
    Promise.resolve().then(() => {
      if (!mounted) return
      const saved = readConversations()
      if (saved.length) { setConversations(saved); setActiveId(saved[0].id) }
      setRestored(true)
    })
    return () => { mounted = false }
  }, [])
  useEffect(() => {
    if (!restored || loading) return
    try { sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations)) }
    catch { /* 저장이 차단되어도 현재 대화는 계속 사용한다. */ }
  }, [conversations, restored, loading])
  useEffect(() => {
    if (!mobileOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', close)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', close) }
  }, [mobileOpen])

  async function copyAnswer(content: string) {
    try { await navigator.clipboard.writeText(content); setNotice('답변을 복사했습니다.') }
    catch { setNotice('복사하지 못했습니다. 답변을 선택해서 복사해 주세요.') }
  }

  function deleteConversation() {
    if (lock.current) return
    const remaining = conversations.filter(item => item.id !== activeId)
    if (remaining.length) { setConversations(remaining); setActiveId(remaining[0].id) }
    else { const id = Date.now(); setConversations([{ id, title: '새로운 대화', messages: [] }]); setActiveId(id) }
    setQuestion(''); setError(''); setNotice('대화를 삭제했습니다.')
  }

  useEffect(() => { fetch('/api/ai').then(res => res.json()).then(data => setConfigured(data.configured)).catch(() => setConfigured(false)) }, [])
  useEffect(() => { if (active.messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [active.messages, loading])

  function newConversation() {
    if (lock.current || !restored) return
    const id = Date.now()
    setConversations(previous => [{ id, title: '새로운 대화', messages: [] }, ...previous.filter(item => item.messages.length)].slice(0, 30))
    setActiveId(id); setQuestion(''); setError(''); setMobileOpen(false)
    inputRef.current?.focus()
  }

  async function send() {
    if (lock.current || !restored || !question.trim()) return
    const content = question.trim()
    const id = activeId
    const messages: Message[] = [...active.messages, { role: 'user', content }]
    lock.current = true; setLoading(true); setError(''); setQuestion('')
    setConversations(previous => previous.map(item => item.id === id ? { ...item, title: item.messages.length ? item.title : content.slice(0, 24), messages } : item))
    try {
      const response = await fetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: messages.slice(-23) }), signal: AbortSignal.timeout(55000) })
      const data = await response.json()
      if (!response.ok || typeof data.answer !== 'string') throw new Error(data.error || '답변을 받지 못했습니다.')
      setConversations(previous => previous.map(item => item.id === id ? { ...item, messages: [...item.messages, { role: 'assistant', content: data.answer }] } : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결에 실패했습니다. 다시 시도해 주세요.')
      setQuestion(content)
      setConversations(previous => previous.map(item => item.id === id ? { ...item, messages: item.messages.slice(0, -1) } : item))
    } finally { lock.current = false; setLoading(false); inputRef.current?.focus() }
  }

  function download() {
    const blob = new Blob([active.messages.map(item => `${item.role === 'user' ? '나' : '모아 AI'}\n${item.content}`).join('\n\n')], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = '모아-AI-대화.txt'; link.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className={styles.app}>
      {mobileOpen && <button className={styles.backdrop} aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} />}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <Link href="/" className={styles.logo}><span className={styles.logoMark}>✳</span>모아<span>AI</span></Link>
        <p className={styles.tagline}>당신의 일상에, 더 나은 생각</p>
        <button className={styles.newChat} onClick={newConversation} disabled={loading || !restored}><span>＋</span> 새로운 대화 <small>↗</small></button>
        <div className={styles.navLabel}>워크스페이스</div>
        <button className={styles.navActive} onClick={() => { setHelp(false); setMobileOpen(false) }}><span>◫</span> AI 채팅 <span className={styles.navDot} /></button>
        <Link className={styles.navItem} href="/study"><span>▤</span> AI 학습</Link>
        <Link className={styles.navItem} href="/weather"><span>☀</span> 오늘의 날씨</Link>
        <Link className={styles.navItem} href="/chart"><span>▥</span> 대화 활동</Link>
        <button className={styles.navItem} onClick={() => { setHelp(true); setMobileOpen(false) }}><span>▧</span> 이용 가이드</button>
        <div className={styles.historyHeading}><span>최근 대화</span><small>이번 방문</small></div>
        <div className={styles.history}>
          {conversations.filter(item => item.messages.length).length === 0 && <p className={styles.emptyHistory}>첫 대화를 시작해 보세요.<br />새로운 생각이 여기 쌓여요.</p>}
          {conversations.filter(item => item.messages.length).map(item => <button key={item.id} disabled={loading} className={item.id === activeId ? styles.historyActive : ''} onClick={() => { setActiveId(item.id); setQuestion(''); setError(''); setHelp(false); setMobileOpen(false) }}>☏ <span>{item.title}</span></button>)}
        </div>
        <div className={styles.sidebarBottom}><div className={styles.tip}><span>✦ 작은 질문도 괜찮아요</span><p>떠오른 생각을 편하게 물어보세요.<br />모아가 함께 정리해 드릴게요.</p></div><div className={styles.profile}><span className={styles.avatar}>나</span><div><strong>나의 워크스페이스</strong><small>계정 없이 편하게 시작하기</small></div><span>⌁</span></div></div>
      </aside>
      <div className={styles.workspace}>
        <header className={styles.topbar}><div><button className={styles.menuButton} aria-label="메뉴 열기" onClick={() => setMobileOpen(true)}>☰</button><strong>AI 채팅</strong><span className={styles.topDivider}>/</span><span>나만의 AI 어시스턴트</span></div><span className={styles.status}><i className={configured ? styles.online : ''} />{configured === null ? '연결 확인 중' : configured ? 'AI 설정 완료' : '연결 준비 중'}</span></header>
        <main id="main-content" tabIndex={-1} className={styles.main}>
          <div className={styles.content}>
            <div className={styles.eyebrow}><span>✦</span> EVERYDAY, A LITTLE SMARTER</div>
            <h1>안녕하세요,<br className={styles.mobileBreak} /> 무엇을 <span>함께 해볼까요?</span></h1>
            <p className={styles.subtitle}>복잡한 질문부터 작은 아이디어까지.<br />모아 AI가 당신의 생각에 한 걸음 더해 드릴게요.</p>
            {configured === false && <div className={styles.connectionNote}><span>◌</span><div><strong>AI 연결을 준비하고 있어요</strong><p>서비스 연결이 완료되면 답변을 받을 수 있어요. 추천 질문과 학습 도구를 먼저 둘러보세요.</p></div></div>}
            {notice && <p className={styles.notice} role="status">{notice}<button aria-label="알림 닫기" onClick={() => setNotice('')}>×</button></p>}
            {help && <section className={styles.guide}><div><h2>모아 AI, 이렇게 사용하세요</h2><button aria-label="가이드 닫기" onClick={() => setHelp(false)}>×</button></div><p>질문을 입력하고 Enter로 전송하세요. Shift+Enter로 줄을 바꿀 수 있어요. 새 대화로 주제를 바꾸고 최근 대화에서 이어가세요. 대화는 현재 브라우저 탭에 최대 30개까지 보관되며 새로고침 후에도 복원됩니다. 저장이 제한된 브라우저에서는 복원되지 않을 수 있어요. 필요한 내용은 다운로드해 주세요.</p><div className={styles.quickLinks}><Link href="/study">AI 학습 시작 ↗</Link><Link href="/weather">오늘의 날씨 ↗</Link><Link href="/chart">대화 활동 보기 ↗</Link></div></section>}
            {!active.messages.length ? <>
              <div className={styles.sectionTitle}><h2>어떤 도움이 필요하세요?</h2><span>아이디어가 필요하다면 여기서 시작해요 ↙</span></div>
              <div className={styles.cards}>{suggestions.map(item => <button key={item.title} className={styles.card} onClick={() => { setQuestion(item.prompt); inputRef.current?.focus() }}><span className={`${styles.cardIcon} ${styles[item.color]}`}>{item.icon}</span><strong>{item.title}</strong><p>{item.text}</p><span className={styles.cardArrow}>↗</span></button>)}</div>
              <div className={styles.sample}><span className={styles.sampleIcon}>✦</span><div><span className={styles.sampleLabel}>이렇게 물어보세요</span><button onClick={() => { setQuestion('오늘 할 일이 너무 많아. 우선순위를 정하는 방법을 알려줘.'); inputRef.current?.focus() }}>“오늘 할 일이 너무 많아. 어디서부터 시작하면 좋을까?” <span>↗</span></button></div></div>
            </> : <section className={styles.conversation} aria-label="대화 내용"><div className={styles.conversationHeading}><span>함께 나눈 이야기</span><div className={styles.conversationTools}><button onClick={download} disabled={loading}>↓ 다운로드</button><button onClick={deleteConversation} disabled={loading}>대화 삭제</button></div></div><div role="log" aria-live="polite">{active.messages.map((item, index) => <article key={index} className={item.role === 'user' ? styles.userMessage : styles.aiMessage}><span className={styles.messageAvatar}>{item.role === 'user' ? '나' : '✳'}</span><div><strong>{item.role === 'user' ? '나' : '모아 AI'}</strong><p>{item.content}</p>{item.role === 'assistant' && <button className={styles.copyButton} onClick={() => void copyAnswer(item.content)}>답변 복사</button>}</div></article>)}{loading && <article className={styles.aiMessage}><span className={styles.messageAvatar}>✳</span><div><strong>모아 AI</strong><p className={styles.thinking}>생각을 정리하고 있어요 <span>•••</span></p></div></article>}</div><div ref={endRef} /></section>}
            <form className={styles.composer} onSubmit={event => { event.preventDefault(); void send() }}>
              <label className={styles.srOnly} htmlFor="question">모아 AI에게 질문하기</label>
              <textarea id="question" ref={inputRef} value={question} maxLength={6000} disabled={loading} placeholder="무엇이든 편하게 물어보세요." onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send() } }} />
              <div className={styles.composerBottom}><span>✳ 모아 AI <small>· 생각을 이어주는 대화</small></span><div><small>{question.length ? `${question.length.toLocaleString()} / 6,000` : 'Enter로 전송'}</small><button type="submit" aria-label="질문 전송" disabled={loading || !restored || !question.trim()}>{loading ? '···' : '↑'}</button></div></div>
            </form>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <p className={styles.disclaimer}>모아 AI의 답변은 정확하지 않을 수 있어요. 중요한 정보는 한 번 더 확인해 주세요.</p>
            <div className={styles.footerNote}><span>✧ 당신의 가능성을 넓히는 작은 대화</span><span>MADE FOR YOUR EVERYDAY</span></div>
          </div>
        </main>
        <footer className={styles.footer}><span>© 2026 모아 AI</span><button onClick={() => setHelp(previous => !previous)}>이용 안내 ↗</button></footer>
      </div>
    </div>
  )
}

