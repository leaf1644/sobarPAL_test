import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Connect, Plugin } from 'vite'
import { createApiHandler } from './api'
import { createSessionStore } from './sessionStore'

export function soberpalApiPlugin(): Plugin {
  const attach = (middlewares: Connect.Server, demo: boolean) => {
    const store = createSessionStore({ persistPath: resolve(process.cwd(), 'data/sessions.json') })
    const handle = createApiHandler(store, { demo })
    const holder = globalThis as { __soberpalWatchdog?: ReturnType<typeof setInterval> }
    if (holder.__soberpalWatchdog) clearInterval(holder.__soberpalWatchdog)
    const timer = setInterval(() => store.watchdogTick(), 5000)
    timer.unref()
    holder.__soberpalWatchdog = timer
    middlewares.use((req: IncomingMessage, res: ServerResponse, next: Connect.NextFunction) => {
      const url = req.url ?? ''
      if (!url.startsWith('/api')) {
        next()
        return
      }
      void handle(req, res).catch((error: unknown) => next(error))
    })
  }

  return {
    name: 'soberpal-api',
    configureServer(server) {
      attach(server.middlewares, true)
    },
    configurePreviewServer(server) {
      attach(server.middlewares, false)
    },
  }
}
