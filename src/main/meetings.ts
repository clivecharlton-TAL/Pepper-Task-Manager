import { exec } from 'child_process'
import { promisify } from 'util'
import type { Meeting } from '../shared/types'

const execAsync = promisify(exec)

export async function fetchUpcomingMeetings(): Promise<Meeting[]> {
  try {
    const script = `
const app = Application('Calendar');
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const meetings = [];
const cals = app.calendars();

for (let c = 0; c < cals.length; c++) {
  try {
    const cal = cals[c];
    if (cal.name() === 'Holidays' || cal.name() === 'Birthdays' || cal.name().includes('Holidays')) continue;

    const events = cal.events({
      where: {
        startDate: { ">=": today, "<": tomorrow }
      }
    });
    
    for (let i = 0; i < events.length; i++) {
      try {
        const ev = events[i];
        let title = ''; try { title = ev.summary(); } catch(e) {}
        let startTime = ''; try { startTime = ev.startDate().toISOString(); } catch(e) {}
        let endTime = ''; try { endTime = ev.endDate().toISOString(); } catch(e) {}
        let description = ''; try { description = ev.description() || ''; } catch(e) {}
        
        const isAllDay = (ev.alldayEvent && ev.alldayEvent()) || 
                         (ev.startDate().getHours() === 0 && ev.endDate().getHours() === 0);
        
        if (!title || !startTime || !endTime || isAllDay) continue;

        let attendees = [];
        try {
          const rawAtt = ev.attendees();
          for (let j = 0; j < rawAtt.length; j++) {
            let name = '';
            try { name = rawAtt[j].displayName(); } catch(e) {}
            if (!name) { try { name = rawAtt[j].email(); } catch(e) {} }
            if (name) attendees.push(name);
          }
        } catch(e) {}

        meetings.push({
          id: ev.uid() + '-' + c + '-' + i,
          title: title,
          description: description,
          start_time: startTime,
          end_time: endTime,
          attendees: attendees,
          url: ''
        });
      } catch (e) {}
    }
  } catch (e) {}
}

const finalMeetings = meetings.filter(m => {
  const start = new Date(m.start_time);
  return start >= today && start < tomorrow;
});

JSON.stringify(finalMeetings);
`
    const { stdout } = await execAsync(`osascript -l JavaScript -e "${script.replace(/"/g, '\\"')}"`)
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
