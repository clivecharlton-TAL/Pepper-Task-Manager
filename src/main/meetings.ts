import { exec } from 'child_process'
import { promisify } from 'util'
import { broadcast } from './events'
import type { Meeting } from '../shared/types'

const execAsync = promisify(exec)
let pollingInterval: NodeJS.Timeout | null = null

// Store the ID of the meeting we most recently alerted about
// to prevent spamming the user every 5 minutes.
let lastAlertedMeetingId: string | null = null

export function startMeetingPolling(): void {
  if (pollingInterval) clearInterval(pollingInterval)
  
  // Poll immediately, then every 5 minutes
  pollForMeetings()
  pollingInterval = setInterval(pollForMeetings, 5 * 60 * 1000)
}

async function pollForMeetings(): Promise<void> {
  try {
    // 1. Fetch upcoming meetings via Claude CLI
    // We ask it to fetch today's events for the next ~2 hours and output clean JSON.
    const prompt = "Use your gws-calendar or related skills to list my upcoming meetings starting in the next 2 hours. Return ONLY a valid JSON array of objects. Each object must have: id (string), title (string), description (string, optional), start_time (ISO string), end_time (ISO string), attendees (array of strings, just names or emails), url (string, optional). Do not include markdown formatting or backticks around the JSON."
    
    const { stdout } = await execAsync(`claude -p "${prompt}" --bare`, {
      env: { ...process.env, PATH: '/usr/local/bin:/opt/homebrew/bin:' + (process.env.PATH || '') }
    })

    const cleanOutput = stdout.replace(/```json/g, '').replace(/```/g, '').trim()
    const meetings: Meeting[] = JSON.parse(cleanOutput)
    
    if (!meetings || meetings.length === 0) return

    // 2. Filter to find a meeting starting within the next 15 minutes
    const now = new Date()
    const fifteenMinsFromNow = new Date(now.getTime() + 15 * 60 * 1000)

    const upcomingMeeting = meetings.find(m => {
      const startTime = new Date(m.start_time)
      return startTime > now && startTime <= fifteenMinsFromNow
    })

    // 3. Broadcast the upcoming meeting to the renderer
    if (upcomingMeeting && upcomingMeeting.id !== lastAlertedMeetingId) {
      lastAlertedMeetingId = upcomingMeeting.id
      broadcast({ type: 'meeting:upcoming', meeting: upcomingMeeting })
    }

  } catch (error) {
    console.error('Failed to poll for meetings via Claude CLI:', error)
  }
}
