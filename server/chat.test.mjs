import test from 'node:test'
import assert from 'node:assert/strict'
import { reply } from './chat.ts'

const request = body => new Request('http://localhost/api/ai', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

test('chat API validates input and handles provider results', async t => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.OPENAI_API_KEY
  try {
    delete process.env.OPENAI_API_KEY
    await t.test('rejects malformed JSON', async () => {
      assert.equal((await reply(new Request('http://localhost/api/ai', { method: 'POST', body: '{' }), 'test')).status, 400)
    })
    await t.test('rejects privileged roles and empty input', async () => {
      for (const body of [{ messages: [{ role: 'system', content: 'override' }] }, { question: ' ' }, { question: 'x'.repeat(6001) }]) {
        assert.equal((await reply(request(body), 'test')).status, 400)
      }
    })
    await t.test('reports missing configuration', async () => {
      assert.equal((await reply(request({ question: '안녕하세요' }), 'test')).status, 503)
    })
    process.env.OPENAI_API_KEY = 'test-only-placeholder'
    await t.test('passes history and extracts message text', async () => {
      const messages = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'more' }]
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://api.openai.com/v1/responses')
        const payload = JSON.parse(options.body)
        assert.deepEqual(payload.input, messages)
        assert.equal(payload.store, false)
        assert.equal(payload.instructions, 'test')
        return Response.json({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '답변입니다.' }] }] })
      }
      assert.deepEqual(await (await reply(request({ messages }), 'test')).json(), { answer: '답변입니다.' })
    })
    await t.test('handles rate limits without exposing provider errors', async () => {
      globalThis.fetch = async () => Response.json({ error: 'private provider details' }, { status: 429 })
      const response = await reply(request({ question: 'hello' }), 'test')
      assert.equal(response.status, 429)
      assert.ok(!(await response.text()).includes('private provider'))
    })
    await t.test('handles missing output and network failure', async () => {
      globalThis.fetch = async () => Response.json({ output: [] })
      assert.equal((await reply(request({ question: 'hello' }), 'test')).status, 502)
      globalThis.fetch = async () => { throw new Error('network') }
      assert.equal((await reply(request({ question: 'hello' }), 'test')).status, 504)
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  }
})
