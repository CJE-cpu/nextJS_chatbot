import test from 'node:test'
import assert from 'node:assert/strict'
import { reply, chatStatus } from './chat.ts'

const request = body => new Request('http://localhost/api/ai', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

test('chat API validates input and handles provider results', async t => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.OPENAI_API_KEY
  const originalProvider = process.env.AI_PROVIDER
  process.env.AI_PROVIDER = 'openai'
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
    await t.test('distinguishes billing codes from temporary rate limits', async () => {
      for (const code of ['insufficient_quota', 'credit_balance_exhausted', 'project_spend_limit_exceeded', 'organization_spend_limit_exceeded', 'organization_usage_limit_exceeded']) {
        globalThis.fetch = async () => Response.json({ error: { code, type: 'insufficient_quota', message: 'private account details' } }, { status: 429 })
        const response = await reply(request({ question: 'hello' }), 'test')
        assert.equal(response.status, 429)
        const data = await response.json()
        assert.equal(data.code, code)
        assert.ok(!data.error.includes('private account'))
        assert.ok(!data.error.includes('잠시'))
      }
      globalThis.fetch = async () => Response.json({ error: { code: 'rate_limit_exceeded' } }, { status: 429 })
      const data = await (await reply(request({ question: 'hello' }), 'test')).json()
      assert.equal(data.code, 'rate_limit_exceeded')
      assert.ok(data.error.includes('잠시'))
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalProvider === undefined) delete process.env.AI_PROVIDER
    else process.env.AI_PROVIDER = originalProvider
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = originalKey
  }
})

test('Gemini defaults, isolation and failures', async t => {
  const names = ['AI_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'OPENAI_API_KEY']
  const saved = Object.fromEntries(names.map(name => [name, process.env[name]]))
  const originalFetch = globalThis.fetch
  try {
    delete process.env.AI_PROVIDER
    delete process.env.GEMINI_API_KEY
    delete process.env.GEMINI_MODEL
    process.env.OPENAI_API_KEY = 'unused-openai-key'
    await t.test('defaults to Gemini and never falls back to OpenAI', async () => {
      let calls = 0
      globalThis.fetch = async () => { calls++; throw new Error('must not fetch') }
      assert.deepEqual(chatStatus(), { provider: 'gemini', configured: false })
      assert.equal((await reply(request({ question: 'hello' }), 'test')).status, 503)
      assert.equal(calls, 0)
    })
    process.env.GEMINI_API_KEY = 'gemini-test-placeholder'
    await t.test('passes system instruction and history to Gemini only', async () => {
      const messages = [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }, { role: 'user', content: 'more' }]
      let sent
      globalThis.fetch = async (url, options) => {
        sent = { url, options }
        return Response.json({ choices: [{ message: { content: 'Gemini answer' } }] })
      }
      const response = await reply(request({ messages }), 'instructions')
      assert.deepEqual(await response.json(), { answer: 'Gemini answer' })
      assert.equal(sent.url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions')
      assert.equal(sent.options.headers.Authorization, 'Bearer gemini-test-placeholder')
      const payload = JSON.parse(sent.options.body)
      assert.equal(payload.model, 'gemini-3.1-flash-lite')
      assert.deepEqual(payload.messages, [{ role: 'system', content: 'instructions' }, ...messages])
      assert.deepEqual(chatStatus(), { provider: 'gemini', configured: true })
    })
    await t.test('handles quota, authentication and empty output without retry', async () => {
      for (const [status, expected] of [[429, 429], [401, 503], [403, 503], [500, 502], [200, 502]]) {
        let calls = 0
        globalThis.fetch = async () => {
          calls++
          return Response.json({ error: { message: 'private key details' }, choices: [] }, { status })
        }
        const response = await reply(request({ question: 'hello' }), 'test')
        assert.equal(response.status, expected)
        assert.equal(calls, 1)
        const text = await response.text()
        assert.ok(!text.includes('private key'))
        assert.ok(!text.includes('OpenAI'))
      }
    })
    await t.test('invalid provider fails closed', async () => {
      process.env.AI_PROVIDER = 'typo'
      let calls = 0
      globalThis.fetch = async () => { calls++; throw new Error('must not fetch') }
      assert.equal((await reply(request({ question: 'hello' }), 'test')).status, 503)
      assert.equal(chatStatus().configured, false)
      assert.equal(calls, 0)
    })
  } finally {
    globalThis.fetch = originalFetch
    for (const name of names) {
      if (saved[name] === undefined) delete process.env[name]
      else process.env[name] = saved[name]
    }
  }
})
