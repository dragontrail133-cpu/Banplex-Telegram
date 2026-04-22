async function stubTelegramWebApp(page, options = {}) {
  const telegramUser = options.user ?? {
    id: 10001,
    first_name: 'Playwright',
    last_name: 'Tester',
    username: 'playwright_tester',
  }
  const startParam = options.startParam ?? 'inv_playwright'

  await page.addInitScript(
    ({ telegramUserPayload, startParamPayload }) => {
      const callLog = {
        ready: 0,
        expand: 0,
        mainButtonShow: 0,
        mainButtonHide: 0,
        mainButtonSetText: [],
        mainButtonOnClick: 0,
      }
      const eventHandlers = new Map()

      const mainButton = {
        show() {
          callLog.mainButtonShow += 1
        },
        hide() {
          callLog.mainButtonHide += 1
        },
        setText(text) {
          callLog.mainButtonSetText.push(String(text))
        },
        onClick(handler) {
          callLog.mainButtonOnClick += 1
          window.__playwrightTelegramMainButtonHandler = handler
        },
      }

      const webApp = {
        initData: '',
        version: '7.0',
        platform: 'web',
        colorScheme: 'light',
        themeParams: {},
        isExpanded: false,
        ready() {
          callLog.ready += 1
        },
        expand() {
          callLog.expand += 1
          webApp.isExpanded = true
        },
        onEvent(eventName, handler) {
          if (!eventName || typeof handler !== 'function') {
            return
          }

          const handlers = eventHandlers.get(eventName) ?? new Set()
          handlers.add(handler)
          eventHandlers.set(eventName, handlers)
        },
        offEvent(eventName, handler) {
          const handlers = eventHandlers.get(eventName)

          if (!handlers || typeof handler !== 'function') {
            return
          }

          handlers.delete(handler)

          if (handlers.size === 0) {
            eventHandlers.delete(eventName)
          }
        },
        MainButton: mainButton,
        HapticFeedback: {
          impactOccurred() {},
        },
      }

      Object.defineProperty(webApp, 'initDataUnsafe', {
        configurable: false,
        enumerable: true,
        value: {
          user: telegramUserPayload,
          start_param: startParamPayload,
        },
        writable: false,
      })

      Object.freeze(webApp.initDataUnsafe)
      Object.freeze(webApp)

      const telegram = {}

      Object.defineProperty(telegram, 'WebApp', {
        configurable: false,
        enumerable: true,
        value: webApp,
        writable: false,
      })

      Object.freeze(telegram)

      Object.defineProperty(window, '__playwrightTelegramCallLog', {
        configurable: true,
        value: callLog,
      })

      Object.defineProperty(window, 'Telegram', {
        configurable: false,
        enumerable: true,
        value: telegram,
        writable: false,
      })
    },
    {
      telegramUserPayload: telegramUser,
      startParamPayload: startParam,
    }
  )
}

async function readTelegramCallLog(page) {
  return page.evaluate(() => window.__playwrightTelegramCallLog ?? null)
}

export { readTelegramCallLog, stubTelegramWebApp }
