/**
 * lib/anthropic.ts
 *
 * Shared Anthropic streaming client.
 * Used by all three portfolio apps with the same pattern:
 *   stream: true → SSE → content_block_delta → onChunk(token)
 */

const ANTHROPIC_API = "https://api.anthropic.com/v1/messages"

export interface StreamOptions {
  system: string
  userMessage: string
  onChunk: (token: string) => void
  onComplete: () => void
  onError: (error: string) => void
  maxTokens?: number
  model?: string
}

export async function streamFromClaude({
  system,
  userMessage,
  onChunk,
  onComplete,
  onError,
  maxTokens = 2048,
  model = "claude-sonnet-4-5",
}: StreamOptions): Promise<() => void> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined

  if (!apiKey) {
    onError("No API key found. Add VITE_ANTHROPIC_API_KEY to your .env.local file.")
    return () => {}
  }

  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(ANTHROPIC_API, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: userMessage }],
          stream: true,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
        onError(err.error?.message ?? `API error ${response.status}`)
        return
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const obj = JSON.parse(raw) as {
              type: string
              delta?: { type?: string; text?: string }
            }
            if (
              obj.type === "content_block_delta" &&
              obj.delta?.type === "text_delta" &&
              obj.delta.text
            ) {
              onChunk(obj.delta.text)
            }
            if (obj.type === "message_stop") {
              onComplete()
              return
            }
          } catch { /* skip malformed chunks */ }
        }
      }
      onComplete()
    } catch (err) {
      if ((err as Error).name === "AbortError") return
      onError((err as Error).message)
    }
  })()

  return () => controller.abort()
}
