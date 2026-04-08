import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { DEFAULT_OVERLAY } from '@shared/constants'

let overlayWindow: BrowserWindow | null = null
let answerWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null
let previewWindow: BrowserWindow | null = null

export function createOverlayWindow(): BrowserWindow {
  const { x, y } = screen.getPrimaryDisplay().workArea
  const overlayWidth = 800
  const overlayHeight = 120

  overlayWindow = new BrowserWindow({
    width: overlayWidth,
    height: overlayHeight,
    x: x + 20,
    y: y + 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    hasShadow: false,
    minWidth: 200,
    minHeight: 60,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Make overlay invisible to screen capture / screen sharing
  overlayWindow.setContentProtection(true)

  // Keep overlay above fullscreen apps
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

  // Prevent overlay from appearing in alt-tab
  overlayWindow.setSkipTaskbar(true)

  overlayWindow.setIgnoreMouseEvents(false)

  // Set opacity
  overlayWindow.setOpacity(DEFAULT_OVERLAY.opacity)

  // Load overlay renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })

  return overlayWindow
}

export function createAnswerWindow(): BrowserWindow {
  const { x, y, width: screenWidth } = screen.getPrimaryDisplay().workArea

  answerWindow = new BrowserWindow({
    width: 940,
    height: 700,
    x: x + Math.max(24, screenWidth - 980),
    y: y + 170,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    hasShadow: false,
    minWidth: 720,
    minHeight: 420,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  answerWindow.setContentProtection(true)
  answerWindow.setAlwaysOnTop(true, 'screen-saver')
  answerWindow.setSkipTaskbar(true)
  answerWindow.setIgnoreMouseEvents(false)
  answerWindow.setOpacity(DEFAULT_OVERLAY.opacity)

  if (process.env.ELECTRON_RENDERER_URL) {
    answerWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html?view=answer`)
  } else {
    answerWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'), {
      query: { view: 'answer' },
    })
  }

  answerWindow.on('closed', () => {
    answerWindow = null
  })

  return answerWindow
}

export function createSettingsWindow(): BrowserWindow {
  settingsWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    frame: true,
    title: 'My Notes',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Also protect settings window from screen capture
  settingsWindow.setContentProtection(true)

  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/settings/index.html`)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/settings/index.html'))
  }

  settingsWindow.on('closed', () => {
    settingsWindow = null
    // Closing the dashboard quits the entire app
    overlayWindow?.close()
    answerWindow?.close()
    previewWindow?.close()
    app.quit()
  })

  return settingsWindow
}

export function createPreviewWindow(): BrowserWindow {
  const { x, y } = screen.getPrimaryDisplay().workArea

  previewWindow = new BrowserWindow({
    width: 800,
    height: 600,
    x: x + 60,
    y: y + 80,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    minimizable: false,
    maximizable: false,
    focusable: true,
    hasShadow: false,
    show: false,
    minWidth: 500,
    minHeight: 400,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  previewWindow.setContentProtection(true)
  previewWindow.setAlwaysOnTop(true, 'screen-saver')
  previewWindow.setSkipTaskbar(true)
  previewWindow.setIgnoreMouseEvents(false)
  previewWindow.setOpacity(DEFAULT_OVERLAY.opacity)

  if (process.env.ELECTRON_RENDERER_URL) {
    previewWindow.loadURL(`${process.env.ELECTRON_RENDERER_URL}/overlay/index.html?view=preview`)
  } else {
    previewWindow.loadFile(join(__dirname, '../renderer/overlay/index.html'), {
      query: { view: 'preview' },
    })
  }

  previewWindow.on('closed', () => {
    previewWindow = null
  })

  return previewWindow
}

export function setContentProtection(enabled: boolean): void {
  overlayWindow?.setContentProtection(enabled)
  answerWindow?.setContentProtection(enabled)
  settingsWindow?.setContentProtection(enabled)
  previewWindow?.setContentProtection(enabled)
}

export function openSettings(): void {
  let win = getSettingsWindow()
  if (!win) {
    win = createSettingsWindow()
  }
  win.show()
  win.focus()
}

export function getOverlayWindow(): BrowserWindow | null {
  return overlayWindow
}

export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow
}

export function getAnswerWindow(): BrowserWindow | null {
  return answerWindow
}

export function toggleOverlay(): void {
  if (!overlayWindow) return
  if (overlayWindow.isVisible()) {
    overlayWindow.hide()
    answerWindow?.hide()
    previewWindow?.hide()
  } else {
    overlayWindow.show()
    answerWindow?.show()
  }
}

export function hideOverlay(): void {
  overlayWindow?.hide()
  answerWindow?.hide()
  previewWindow?.hide()
}

export function showOverlay(): void {
  if (overlayWindow) {
    overlayWindow.show()
    overlayWindow.setAlwaysOnTop(true, 'screen-saver')
    overlayWindow.focus()
  }
  if (answerWindow?.isVisible()) {
    answerWindow.show()
    answerWindow.setAlwaysOnTop(true, 'screen-saver')
  }
}

export function toggleAnswerWindow(): void {
  if (!answerWindow) return
  if (answerWindow.isVisible()) {
    answerWindow.hide()
  } else {
    answerWindow.show()
  }
}

export function hideAnswerWindow(): void {
  answerWindow?.hide()
}

export function showAnswerWindow(): void {
  answerWindow?.show()
}

export function resizeOverlayWindow(width: number, height: number): void {
  if (!overlayWindow) return

  const bounds = overlayWindow.getBounds()
  overlayWindow.setBounds({
    ...bounds,
    width: Math.max(200, Math.round(width)),
    height: Math.max(60, Math.round(height)),
  })
}

export function getAnswerWindowBounds(): { x: number; y: number; width: number; height: number } | null {
  return answerWindow ? answerWindow.getBounds() : null
}

export function setAnswerWindowBounds(bounds: Partial<{ x: number; y: number; width: number; height: number }>): void {
  if (!answerWindow) return
  const current = answerWindow.getBounds()
  answerWindow.setBounds({
    x: bounds.x ?? current.x,
    y: bounds.y ?? current.y,
    width: bounds.width ?? current.width,
    height: bounds.height ?? current.height,
  })
}

export function getPreviewWindow(): BrowserWindow | null {
  return previewWindow
}

export function togglePreviewWindow(): void {
  if (!previewWindow) return
  if (previewWindow.isVisible()) {
    previewWindow.hide()
  } else {
    previewWindow.show()
  }
}

export function hidePreviewWindow(): void {
  previewWindow?.hide()
}

export function showPreviewWindow(): void {
  previewWindow?.show()
}

export function getPreviewWindowBounds(): { x: number; y: number; width: number; height: number } | null {
  return previewWindow ? previewWindow.getBounds() : null
}

export function setPreviewWindowBounds(bounds: Partial<{ x: number; y: number; width: number; height: number }>): void {
  if (!previewWindow) return
  const current = previewWindow.getBounds()
  previewWindow.setBounds({
    x: bounds.x ?? current.x,
    y: bounds.y ?? current.y,
    width: bounds.width ?? current.width,
    height: bounds.height ?? current.height,
  })
}
