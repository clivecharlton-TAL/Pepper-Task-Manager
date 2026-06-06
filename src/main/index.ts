import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell, ipcMain, clipboard } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { syncLabelsFromDrive } from './db'
import { broadcast } from './events'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null
let quickAddWindow: BrowserWindow | null = null
let tray: Tray | null = null
let pendingUrl: string | null = null

function handleOpenUrl(url: string): void {
  try {
    const parsed = new URL(url)
    if (parsed.hostname === 'task') {
      const title = parsed.searchParams.get('title') ?? ''
      const notes = parsed.searchParams.get('notes') ?? ''
      toggleQuickAdd({ title, notes })
    }
  } catch {
    // malformed URL — ignore
  }
}

// Must be registered before app.whenReady() to catch launch-time URLs
app.on('open-url', (event, url) => {
  event.preventDefault()
  if (!quickAddWindow) {
    pendingUrl = url
  } else {
    handleOpenUrl(url)
  }
})

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#1c1c1e',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function createQuickAddWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 560,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    vibrancy: 'hud',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    transparent: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#quick-add`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'quick-add' })
  }

  // Hide on blur with a delay to survive the macOS focus handoff on first show
  let blurTimer: ReturnType<typeof setTimeout> | null = null
  win.on('blur', () => {
    blurTimer = setTimeout(() => {
      if (!win.isFocused()) win.hide()
    }, 150)
  })
  win.on('focus', () => {
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null }
  })

  return win
}

// ─── Context types ───────────────────────────────────────────────────────────

interface EmailContext { id: string; subject: string; body?: string }
interface TextContext  { title: string; notes?: string }

// Pending context: renderer pulls this on focus via quick-add:context IPC
let pendingCtx: EmailContext | TextContext | null = null

function toggleQuickAdd(ctx?: EmailContext | TextContext): void {
  if (!quickAddWindow) return

  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide()
    return
  }

  pendingCtx = ctx ?? null

  // Center on screen
  const { screen } = require('electron')
  const display = screen.getPrimaryDisplay()
  const { width, height } = display.workAreaSize
  const winBounds = quickAddWindow.getBounds()
  quickAddWindow.setPosition(
    Math.round((width - winBounds.width) / 2),
    Math.round(height * 0.3)
  )

  app.focus({ steal: true })
  quickAddWindow.show()
  quickAddWindow.focus()
}

function createTray(): Tray {
  const icon = nativeImage.createFromDataURL(TRAY_ICON_BASE64)
  icon.setTemplateImage(true)
  const t = new Tray(icon)

  const menu = Menu.buildFromTemplate([
    { label: 'Open Pepper Tasks', click: () => { mainWindow?.show(); mainWindow?.focus() } },
    { label: 'Quick Add  ⌘⇧Space', click: () => toggleQuickAdd() },
    { type: 'separator' },
    {
      label: 'Sync Labels from Drive',
      click: async () => {
        const drivePath = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
        const result = await syncLabelsFromDrive(drivePath)
        if (result.added > 0) broadcast({ type: 'labels:changed', added: result.added })
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  t.setToolTip('Pepper Tasks')
  t.setContextMenu(menu)
  t.on('click', () => { mainWindow?.show(); mainWindow?.focus() })

  return t
}

// pepper tray icon (44px @2x = 22pt, template)
const TRAY_ICON_BASE64 = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABgAAAAYCAYAAADgdz34AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAsQAAALEBxi1JjQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAF8SURBVEiJtdW/axRBGMbxj3f4IwSDQlLYpA0YK5V0gp0iJBbXqJUQA9G/wVKIV1kEUqWxESyTJk0QiZhoa6qAYEAOFcT88jhUzFnsHO5d9tbdc++BF4adl+c7874zO/Sm19jFW8yg1KNPV71CMxaLRQPgNO7ie4Bc7wcEHgbA834BLgXA+36Y38ebADgU9Wa2SMBX7c1u4ks8oZfjVcZ4GD9NmG99u4DjPfi7h7UwPoUqPoR4jJNhbgUPoIJPISoZAK07MJeSUw0561Dzt361DICDWP4LTGI0xBRexubr0NDepPMp5sOONjUtfpew02EynQK4nGGHcX2Ddx3UH7iSkFzGRs4dbJZFN/Fih9EtnBA1fl9UtmddwGlahds5V5Un7sAZ7PXBfA9nS6KHYyHn1rPoidgBGsbnAle/jaFO4lX8KsC8IeU4T/8npI6baXWDa6La5TX/iIl/mbc0gnn8zLjqRxhMMjqWATSJGxjDOQyInsctLGNJ9ANM1B9ebd9s4LOUyQAAAABJRU5ErkJggg==`

app.whenReady().then(async () => {
  registerIpcHandlers()

  mainWindow = createMainWindow()
  quickAddWindow = createQuickAddWindow()
  tray = createTray()

  if (pendingUrl) {
    handleOpenUrl(pendingUrl)
    pendingUrl = null
  }

  // Silently pick up any new Drive folders added since last launch
  const drivePath = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
  syncLabelsFromDrive(drivePath).then(({ added }) => {
    if (added > 0) broadcast({ type: 'labels:changed', added })
  }).catch(() => { /* Drive not mounted — ignore */ })

  globalShortcut.register('CommandOrControl+Shift+Space', () => toggleQuickAdd())

  globalShortcut.register('CommandOrControl+Shift+E', () => {
    const title = clipboard.readText().trim()
    toggleQuickAdd({ title })
  })

  app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      mainWindow = createMainWindow()
    } else {
      mainWindow.show()
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Keep app alive when all windows closed (menu bar app behaviour)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Expose toggle for IPC
ipcMain.on('quick-add:hide', () => quickAddWindow?.hide())
ipcMain.on('main-window:show', () => { mainWindow?.show(); mainWindow?.focus() })
ipcMain.handle('quick-add:context', () => {
  const ctx = pendingCtx
  pendingCtx = null
  return ctx
})

