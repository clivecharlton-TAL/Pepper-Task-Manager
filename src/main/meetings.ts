import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'
import * as path from 'path'
import type { Meeting } from '../shared/types'

const execAsync = promisify(exec)

export async function fetchUpcomingMeetings(dateString?: string): Promise<Meeting[]> {
  const targetDateStr = dateString ? dateString : new Date().toISOString();
  const target = new Date(targetDateStr);

  const startOfDay = new Date(target);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(target);
  endOfDay.setHours(23, 59, 59, 999);

  // Apple CoreData stores dates as seconds since Jan 1, 2001
  const MAC_EPOCH = 978307200;
  // Pad by +/- 24 hours (86400 seconds) to ensure timezone boundary safety in UTC
  const startMac = (startOfDay.getTime() / 1000) - MAC_EPOCH - 86400;
  const endMac = (endOfDay.getTime() / 1000) - MAC_EPOCH + 86400;

  const query = `
    SELECT
      item.ROWID as id,
      item.summary as title,
      item.description as description,
      item.start_date as start_time,
      item.end_date as end_time,
      item.all_day as is_all_day
    FROM CalendarItem item
    JOIN Calendar cal ON item.calendar_id = cal.ROWID
    WHERE cal.title = 'clive.charlton@takealot.com'
      AND item.start_date >= ${startMac}
      AND item.start_date < ${endMac};
  `;

  const dbPath = path.join(os.homedir(), 'Library', 'Group Containers', 'group.com.apple.calendar', 'Calendar.sqlitedb');

  let stdout: string
  try {
    ;({ stdout } = await execAsync(`sqlite3 -json "${dbPath}" "${query.replace(/\n/g, ' ')}"`))
  } catch (error) {
    throw new Error(`Could not query local Calendar database: ${(error as Error).message}`)
  }

  if (!stdout || stdout.trim() === '') return [];

  let rows: Record<string, unknown>[]
  try {
    rows = JSON.parse(stdout.trim())
  } catch (error) {
    throw new Error(`Could not parse Calendar query result: ${(error as Error).message}`)
  }

  const finalMeetings: Meeting[] = [];

  for (const row of rows) {
    if (row.is_all_day) continue;

    const start = new Date(((row.start_time as number) + MAC_EPOCH) * 1000);
    const end = new Date(((row.end_time as number) + MAC_EPOCH) * 1000);

    // Filter exactly to the target day in JavaScript
    const startsToday = start >= startOfDay && start < endOfDay;
    const spansToday = start < startOfDay && end > startOfDay;
    if (!startsToday && !spansToday) continue;

    // Some holidays use exact midnight boundaries instead of the all_day flag
    if (start.getHours() === 0 && end.getHours() === 0 && start.getMinutes() === 0 && end.getMinutes() === 0) continue;

    finalMeetings.push({
      id: (row.id as number | string).toString(),
      title: (row.title as string) || 'Untitled Meeting',
      description: (row.description as string) || '',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      attendees: [], // SQLite join for attendees is complex, skipping for raw speed
      url: ''
    });
  }

  finalMeetings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  return finalMeetings;
}
