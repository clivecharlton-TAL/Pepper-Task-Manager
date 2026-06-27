import { test, expect, describe } from 'vitest';
import fc from 'fast-check';
import { fetchUpcomingMeetings } from './meetings';

describe('fetchUpcomingMeetings', () => {
  test('returns meetings properly bounded to the local day', async () => {
    // Generate valid random dates between 2020 and 2030
    await fc.assert(
      fc.asyncProperty(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
        async (testDate) => {
          const dateString = testDate.toISOString();
          const meetings = await fetchUpcomingMeetings(dateString);
          
          // Verify it doesn't crash and returns an array
          expect(Array.isArray(meetings)).toBe(true);

          // Get local day boundaries for the test date
          const startOfDay = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 0, 0, 0, 0);
          const endOfDay = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate(), 23, 59, 59, 999);

          for (const m of meetings) {
            const mStart = new Date(m.start_time);
            const mEnd = new Date(m.end_time);

            // Property: Every returned meeting must overlap with the local day boundaries
            const startsToday = mStart >= startOfDay && mStart <= endOfDay;
            const spansToday = mStart < startOfDay && mEnd > startOfDay;

            expect(startsToday || spansToday).toBe(true);
          }
        }
      ),
      { numRuns: 20 } // Test 20 random days against the live database
    );
  });

  // Explicit test for the user's specific failure date: June 29, 2026
  test('correctly fetches June 29, 2026 meetings', async () => {
    const meetings = await fetchUpcomingMeetings("2026-06-29T00:00:00.000Z");
    
    // We expect actual meetings on this date based on previous manual sqlite checks
    expect(meetings.length).toBeGreaterThan(0);
    
    console.log(`Found ${meetings.length} meetings for June 29, 2026:`);
    meetings.forEach(m => console.log(`- ${m.title} (${m.start_time})`));
  });
});
