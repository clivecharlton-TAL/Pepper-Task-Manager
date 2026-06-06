import { BrowserWindow } from 'electron'
import type { DomainEvent } from '../shared/types'

export function broadcast(event: DomainEvent): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('domain-event', event)
  }
}
