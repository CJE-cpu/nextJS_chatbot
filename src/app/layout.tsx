import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import GuideChatbot from './components/GuideChatbot'
import Header from './components/Header'

export const metadata: Metadata = {
  title: '모아 AI — 생각을 이어주는 대화',
  description: '글쓰기, 학습, 아이디어와 일상까지. 모아 AI와 함께 시작하세요.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="ko"><body><a href="#main-content" className="skipLink">본문으로 이동</a><Header />{children}<GuideChatbot /></body></html>
}
