export type Message = { role: 'user' | 'assistant'; content: string }
export type Conversation = { id: number; title: string; messages: Message[] }
export const CHAT_STORAGE_KEY = 'moa-conversations-v1'

export function readConversations(): Conversation[] {
  try {
    const data: unknown = JSON.parse(sessionStorage.getItem(CHAT_STORAGE_KEY) || '[]')
    if (!Array.isArray(data)) return []
    const ids = new Set<number>()
    return data.filter((item): item is Conversation => {
      if (!item || typeof item.id !== 'number' || !Number.isFinite(item.id) || ids.has(item.id) ||
        typeof item.title !== 'string' || !Array.isArray(item.messages) ||
        !item.messages.every((message: Message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')) return false
      ids.add(item.id)
      return true
    }).slice(0, 30)
  } catch { return [] }
}
