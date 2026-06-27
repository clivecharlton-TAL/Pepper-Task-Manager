import { exec } from 'child_process'
import { promisify } from 'util'
import type { Meeting } from '../shared/types'

const execAsync = promisify(exec)

export async function fetchUpcomingMeetings(dateString?: string): Promise<Meeting[]> {
  try {
    const script = `
const app = Application('Calendar');
const targetDateStr = ${dateString ? `"${dateString}"` : `null`};
const today = targetDateStr ? new Date(targetDateStr) : new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const meetings = [];
const cals = app.calendars();

// The previous script was looping through ALL calendars, which includes huge archives,
// shared team calendars, holiday lists, etc. We must ONLY query the primary calendar
// to prevent the AppleScript bridge from choking.
for (let c = 0; c < cals.length; c++) {
  try {
    const cal = cals[c];
    if (cal.name() !== 'clive.charlton@takealot.com') continue;

    // We do NOT use the .whose() query. As proven by testing, .whose() crashes the OS 
    // bridge completely when querying heavy corporate Exchange/Google calendars via Calendar.app.
    // Instead, we just call .events() which gives us a chronological list, and we iterate.
    const events = cal.events();
    
    // Iterate forwards. Because it's chronological, we can break entirely once we pass tomorrow.
    for (let i = 0; i < events.length; i++) {
      try {
        const ev = events[i];
        let startTime = ''; try { startTime = ev.startDate().toISOString(); } catch(e) {}
        
        const start = new Date(startTime);
        if (start >= tomorrow) {
          break; // Stop parsing completely
        }
        
        let endTime = ''; try { endTime = ev.endDate().toISOString(); } catch(e) {}
        const end = new Date(endTime);
        
        const startsToday = start >= today && start < tomorrow;
        const spansToday = start < today && end > today;
        
        if (!startsToday && !spansToday) continue;

        let title = ''; try { title = ev.summary(); } catch(e) {}
        
        const isAllDay = (ev.alldayEvent && ev.alldayEvent()) || 
                         (start.getHours() === 0 && end.getHours() === 0) ||
                         (start.getHours() === 2 && end.getHours() === 2 && start.getMinutes() === 0 && end.getMinutes() === 0);
        
        if (!title || isAllDay) continue;

        meetings.push({
          id: ev.uid() + '-' + c + '-' + i,
          title: title,
          description: '',
          start_time: startTime,
          end_time: endTime,
          attendees: [],
          url: ''
        });
      } catch (e) {}
    }
  } catch (e) {}
}

const finalMeetings = meetings.filter(m => {
  const start = new Date(m.start_time);
  const end = new Date(m.end_time);
  const startsToday = start >= today && start < tomorrow;
  const spansToday = start < today && end > today;
  return startsToday || spansToday;
});

JSON.stringify(finalMeetings);
`
    const { stdout } = await execAsync(`osascript -l JavaScript -e "${script.replace(/"/g, '\\"')}"`, {
      timeout: 10000 
    })
    const parsed = JSON.parse(stdout.trim())
    
    const uniqueIds = new Set()
    const finalMeetings: Meeting[] = []
    
    for (const m of parsed) {
      const dedupKey = m.title + m.start_time
      if (!uniqueIds.has(dedupKey)) {
        uniqueIds.add(dedupKey)
        finalMeetings.push(m)
      }
    }
    
    finalMeetings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    return finalMeetings
  } catch (error) {
    console.error('Failed to fetch from local Calendar app:', error)
    return []
  }
}
