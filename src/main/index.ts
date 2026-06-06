import { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell, ipcMain } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { syncLabelsFromDrive } from './db'
import { broadcast } from './events'
import { is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null
let quickAddWindow: BrowserWindow | null = null
let tray: Tray | null = null

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

function toggleQuickAdd(emailContext?: { id: string; subject: string }): void {
  if (!quickAddWindow) return

  if (quickAddWindow.isVisible()) {
    quickAddWindow.hide()
    return
  }

  if (emailContext) {
    quickAddWindow.webContents.send('set-email-context', emailContext)
  }

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

// 22×22 chilli pepper tray icon
const TRAY_ICON_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAADU0lEQVR4nK2UTWhcVRTH/+fe' +
  '+2Yyk2nS0lbbUi1YSBTEJtaIZjOh1ZI6kIXw3EihuOhKF4oLcfN8Ql1YqBvBqogbVw7oSogoaQaKdRNsbbGItWAtjZnW' +
  'pJ2+TGbm3XuO3GdjP0xoYjzwFu++837nf+75AP4HiyKou89o7VQoxODKB3uepKJ+3ir9zviB8YZZCzOMwlwddS4eCx6n' +
  'PO9ekgZrEiy4lf7YR3vOVT7e++nt3/+LYpIIRINj3QPnkle5oItXmrz9YOHaoa+y+45UHMe8askSRYrimJPKwHMXenJf' +
  'XOzS+Yl1KqntKLyXY3r/5OvfXMmirwoahpqqVZdWdo8YwrdwQmmS2nlB7sudhdnDu0rPnn9t4oe3oohWDJZFEaOjOYs/' +
  'TpvA9FvHbt6xSlpM3W13af33s/2E6ab3/Vf/LWthqAgQq6aHTWldv3XiNEFrAVkWJF16++/lzQ9lvtFqwPU6eSWk809h' +
  '/SaBIvFpWIZ4iLC0rdI3Mt/4tpa5p42M+EoL5QsVpCn5R4jQcSxBFkSmZxvq8k3vLNjKihbH3NnbN6SKpac5abBSpFMn' +
  'aFnmbqMIRONPTE2lx8tlQysBiy9avZ4VTvXc9y5MoLh5Q6AUrrWtaCJKUtcSxpEssVqNM997yj2021CtZu3oY2/ojZtH' +
  '3NxVpyE66TAWLNsNgdGpyNs7Tpy5kGUGZOBl2038cvkpJN+3dt+jL+ktD37irHM0N6M6QjSTpHZDzpjrzh1/oHbmGYQh' +
  'oVrN6rAkWPxZuay9Sv/e2T/wZrBxy2EHxTQ7TSmDZuZTWzLatJ2cB6vhrSdOXfWsRbV3gMUrnCyrRaDsH+pzio9qoyqO' +
  'AtZpi5qW8eeCtT3GBC3Hv153sq/fX0EERfEt6NKKxwa3MauXRfCK1qrEzln202WFm6mYXqOQOJ6c67RffOS7ny9/HkK/' +
  'UIW7m5M1fTWEClu7HgbMQQgOQKv72c8ri12wElgnpEFoO1dnUkePTZ4+EgO8lNI7wBgd2NQBTuWKXduQumycWHyPChqp' +
  'g0B+UUSfzSv+cOfE2Rn/YwQoD1+u+H+PKYDfhge35nN2yAr6mKVXiBYCwaWiwdneRu5HmppKs6u6ueGWA67apFw2/2y4' +
  'FdhfPZykLwer/1AAAAAASUVORK5CYII='

app.whenReady().then(async () => {
  registerIpcHandlers()

  mainWindow = createMainWindow()
  quickAddWindow = createQuickAddWindow()
  tray = createTray()

  // Silently pick up any new Drive folders added since last launch
  const drivePath = join(homedir(), 'Library/CloudStorage/GoogleDrive/My Drive')
  syncLabelsFromDrive(drivePath).then(({ added }) => {
    if (added > 0) broadcast({ type: 'labels:changed', added })
  }).catch(() => { /* Drive not mounted — ignore */ })

  globalShortcut.register('CommandOrControl+Shift+Space', () => toggleQuickAdd())

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

