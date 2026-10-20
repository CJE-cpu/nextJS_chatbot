import type { StudyItem } from '@/types/study'

export const studyData: StudyItem[] = [
  { id: 1, title: '개념 설명', description: '어려운 개념도 쉬운 예시로 이해해요.', mode: 'explain' },
  { id: 2, title: '퀴즈 풀기', description: '직접 풀어 보고 정답과 해설을 확인해요.', mode: 'quiz' },
  { id: 3, title: '힌트 받기', description: '스스로 해결할 수 있도록 실마리를 찾아요.', mode: 'hint' },
]
