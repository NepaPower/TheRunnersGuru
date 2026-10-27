/** The "What's new" list, newest first. One entry per day something shipped.
 * `id` is the ISO date and is what the "new" dot compares against what a person
 * last saw, so add new entries at the TOP with a later date. Keep the wording
 * plain: this is read by runners, not developers. */
export interface WhatsNewEntry {
  id: string; // yyyy-mm-dd
  title: string;
  items: string[];
}

export const WHATS_NEW: WhatsNewEntry[] = [
  {
    id: '2026-10-27',
    title: 'Your running background',
    items: [
      'New Background tab in Profile: add the races you have already run (with finish time and notes) and your current or past injuries.',
      'Injuries are private. Only you can see them, never your crew or other runners.',
      'Marathon goal times can now go up to 9 hours, for slower trail marathons.',
      'A closer look at the Crew Plan on the home page: GPX upload, arrival times, weather at every station, crew, offline and more.',
    ],
  },
  {
    id: '2026-10-22',
    title: 'Plans that fit where you are',
    items: [
      'Your training plan now opens one week at a time, in big day cards. Every week is still in the list below, and you can unfold any of them.',
      'Tap "Log run" on any day to log it: Log a Run opens with that day\'s date and the planned miles filled in, and logged runs show as a green badge.',
      'New "Current running" step: your average weekly miles and longest run, so your plan starts where you actually are. Update them any time under My Races → Edit, or fill them from your logged runs.',
      'If your race is closer than a safe build allows, the plan says so plainly and shifts to staying fresh and race-ready.',
      'Ultra plans are more realistic: 2-hour Tuesday, Wednesday and Thursday runs, long runs that build as a range (up to 9 hours for the biggest races), and Sunday back-to-backs. A quick warm-up reminder sits above each week.',
      '50 Miles is now a distance choice, and Add race shows how many weeks are left.',
      'Only here to crew or pace someone? Pick that when you sign up and skip the plan questions.',
      'You can delete your own account any time: Profile → Settings → Delete my account.',
    ],
  },
  {
    id: '2026-10-21',
    title: 'A new address and safer accounts',
    items: [
      'The Runners Guru now lives at therunnersguru.com. The old link still works and sends you there.',
      'Forgot your password? There\'s a link on sign-in, and a "Change my password" button in Profile.',
      'New accounts confirm their email, and the emails now come from The Runners Guru.',
      'Privacy and Terms pages, linked at the bottom of every screen.',
      'The top bar now stays put as you scroll, and the last lines of every page are no longer hidden behind the bottom tabs on phones.',
      'Short on time before a race? Ultra plans now hold your fitness and taper instead of cramming in a build.',
    ],
  },
  {
    id: '2026-10-20',
    title: 'A fresh look',
    items: [
      'A 4-week running calendar on Home. Tap any day to log a run for it.',
      'Home now shows today\'s workout, with the pace to run and a countdown to your race.',
      'New headers and sharper cards across the app, and a new sign-in and sign-up look.',
      'Races that are over are marked Completed, and you get a short grace period to fix a wrong date before they lock.',
    ],
  },
];

export const LATEST_WHATS_NEW_ID = WHATS_NEW[0].id;

const SEEN_KEY = 'rg-whatsnew-seen';

/** The id of the newest entry this browser has seen, or '' if none / storage is unavailable. */
export function seenWhatsNewId(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}

/** Remembers that the newest entry has now been seen. */
export function markWhatsNewSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, LATEST_WHATS_NEW_ID);
  } catch {
    // private windows and blocked storage just keep showing the dot; harmless
  }
}

/** True when there is an entry newer than the one this browser last saw. */
export function hasUnseenWhatsNew(): boolean {
  return seenWhatsNewId() < LATEST_WHATS_NEW_ID;
}
