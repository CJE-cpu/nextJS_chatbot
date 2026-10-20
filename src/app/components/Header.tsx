'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './Header.module.scss'

const links = [ ['/', 'AI 채팅'], ['/study', 'AI 학습'], ['/weather', '오늘의 날씨'], ['/chart', '대화 활동'] ]

export default function Header() {
  const pathname = usePathname()
  if (pathname === '/') return null
  return <header className={styles.header}><Link className={styles.logo} href="/"><span>✳</span> 모아 <small>AI</small></Link><nav aria-label="서비스 메뉴">{links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}</nav><span className={styles.caption}>생각을 이어주는 공간</span></header>
}
