'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readConversations, type Conversation } from '@/data/conversations'
import styles from './page.module.scss'

export default function ChartPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let mounted = true
    Promise.resolve().then(() => { if (mounted) { setConversations(readConversations().filter(item => item.messages.length)); setReady(true) } })
    return () => { mounted = false }
  }, [])
  const questions = conversations.reduce((total, item) => total + item.messages.filter(message => message.role === 'user').length, 0)
  const answers = conversations.reduce((total, item) => total + item.messages.filter(message => message.role === 'assistant').length, 0)
  const maximum = Math.max(1, ...conversations.map(item => item.messages.length))

  return <main id="main-content" tabIndex={-1} className="servicePage"><header className="serviceIntro"><p>SMALL CONVERSATIONS, GROWING IDEAS</p><h1>대화로 쌓인 나의 생각</h1><span>얼마나 많은 질문을 나눴을까요?<br />현재 탭에 보관된 AI 대화 활동을 한눈에 확인하세요.</span></header>
    <section className={styles.stats} aria-label="대화 요약">{[['나눈 대화', conversations.length, '개의 이야기'], ['궁금했던 순간', questions, '개의 질문'], ['함께 찾은 답', answers, '개의 답변']].map(([label, value, unit]) => <div key={label}><span>{label}</span><strong>{ready ? value : '—'}</strong><small>{unit}</small></div>)}</section>
    <section className={`serviceCard ${styles.chart}`}><div className={styles.heading}><h2>대화별 메시지 수</h2><span>질문 + AI 답변</span></div>{!ready ? <p role="status">대화 활동을 불러오고 있어요…</p> : conversations.length ? <><div className={styles.bars}>{conversations.map(item => <div className={styles.row} key={item.id}><div><span title={item.title}>{item.title}</span><strong>{item.messages.length}개</strong></div><div className={styles.track}><div style={{ width: `${item.messages.length / maximum * 100}%` }} /></div></div>)}</div><Link className={styles.link} href="/">이야기 이어가기 ↗</Link></> : <div className={styles.empty}><span>▥</span><h3>첫 대화가 기다리고 있어요</h3><p>AI에게 질문하면 이곳에 나의 대화 활동이 쌓여요.</p><Link className={styles.link} href="/">첫 대화 시작하기 ↗</Link></div>}</section>
    <p className="serviceNote">현재 탭에 저장된 최대 30개 대화를 기준으로 계산합니다. 삭제한 대화는 집계에서 제외되며, 브라우저 저장이 차단되면 표시되지 않을 수 있어요.</p></main>
}
