import type { DistanceGoal, PartnerMatch, UltraDistanceId } from '../types';

export const DISTANCES: { id: DistanceGoal; label: string }[] = [
  { id: '5k', label: '5K' },
  { id: '10k', label: '10K' },
  { id: 'half', label: 'Half marathon' },
  { id: 'full', label: 'Marathon' },
  { id: 'ultra', label: 'Ultra (50K+)' },
];

export const DISTANCE_LABELS: Record<DistanceGoal, string> = Object.fromEntries(
  DISTANCES.map((d) => [d.id, d.label]),
) as Record<DistanceGoal, string>;

/** Step 2's picker when raceCategory === 'standard' — everything except ultra,
 * which gets its own picker (see ULTRA_DISTANCES) once raceCategory === 'ultra'
 * is chosen in Step 1. */
export const STANDARD_DISTANCES = DISTANCES.filter((d) => d.id !== 'ultra');

/** Step 2's picker when raceCategory === 'ultra'. 'custom' pairs with a typed
 * mileage input capped at MAX_ULTRA_MILES. */
export const ULTRA_DISTANCES: { id: Exclude<UltraDistanceId, ''>; label: string; miles?: number }[] = [
  { id: '50k', label: '50K', miles: 31 },
  { id: '100k', label: '100K', miles: 62 },
  { id: '100mi', label: '100 Miles', miles: 100 },
  { id: '135mi', label: '135 Miles', miles: 135 },
  { id: '200mi', label: '200 Miles', miles: 200 },
  { id: '300mi', label: '300 Miles', miles: 300 },
  { id: 'custom', label: 'Enter my own distance' },
];

export const MAX_ULTRA_MILES = 500;

export const FIRST_TIME_OPTIONS = [
  { id: 'yes', label: 'Yes, this is my first time' },
  { id: 'no', label: "No, I've done this distance before" },
] as const;

/** Only asked when the selected distance is Ultra — determines whether
 * climbing-specific sessions are prescribed as outdoor hill repeats or
 * their treadmill-incline / StairMaster equivalents. */
export const HILL_ACCESS_OPTIONS = [
  { id: 'yes', label: 'Yes, I have hills or trails nearby' },
  { id: 'no', label: "No — I'll need treadmill or StairMaster substitutes" },
] as const;

export const PACES_MI = [
  { id: 'easy', label: 'Easy — 11:00/mi or slower' },
  { id: 'steady', label: 'Steady — 8:00–11:00/mi' },
  { id: 'fast', label: 'Fast — under 8:00/mi' },
] as const;

export const PACES_KM = [
  { id: 'easy', label: 'Easy — 6:50/km or slower' },
  { id: 'steady', label: 'Steady — 5:00–6:50/km' },
  { id: 'fast', label: 'Fast — under 5:00/km' },
] as const;

/** Used instead of PACES_MI/PACES_KM when distanceGoal === 'ultra' — road
 * pace bands don't hold up once climbing and power-hiking enter the
 * picture, so the whole range shifts slower and "Easy" explicitly covers
 * hiking effort on climbs rather than just a slow jog. */
export const PACES_MI_ULTRA = [
  { id: 'easy', label: 'Easy — 16:00/mi or slower (includes hiking on climbs)' },
  { id: 'steady', label: 'Steady — 12:00–16:00/mi' },
  { id: 'fast', label: 'Fast — under 12:00/mi' },
] as const;

export const PACES_KM_ULTRA = [
  { id: 'easy', label: 'Easy — 10:00/km or slower (includes hiking on climbs)' },
  { id: 'steady', label: 'Steady — 7:30–10:00/km' },
  { id: 'fast', label: 'Fast — under 7:30/km' },
] as const;

export const PACE_CUSTOM = { id: 'custom', label: 'Enter my own pace' } as const;

export const RUNNING_QUOTES = [
  "The miracle isn't that you finished. The miracle is that you had the courage to start.",
  'Run when you can, walk if you have to, crawl if you must; just never give up.',
  "It's not about being the best. It's about being better than you were yesterday.",
  "Every mile you run today is a mile you won't have to run on race day.",
  'The pain of discipline is far less than the pain of regret.',
  'You are stronger than you think, and more capable than you know.',
];

/** Mocked "distance from signup address" table — a real backend would replace
 * this with an actual race-finder API keyed off geocoded address + radius. */
export const RACES_BY_DISTANCE: Record<DistanceGoal, { name: string; miles: number }[]> = {
  '5k': [
    { name: 'Turkey Trot 5K', miles: 6 },
    { name: 'Color Run 5K', miles: 18 },
    { name: 'Local Parkrun 5K', miles: 3 },
    { name: 'Downtown Dash 5K', miles: 52 },
  ],
  '10k': [
    { name: 'Great River 10K', miles: 11 },
    { name: 'City Pulse 10K', miles: 24 },
    { name: 'Bridge Run 10K', miles: 61 },
  ],
  half: [
    { name: 'Riverside Half Marathon', miles: 9 },
    { name: 'Sunrise Half', miles: 33 },
    { name: 'Coastal Half Marathon', miles: 78 },
  ],
  full: [
    { name: 'Chicago Marathon', miles: 14 },
    { name: 'Boston Marathon', miles: 145 },
    { name: 'New York City Marathon', miles: 210 },
  ],
  ultra: [
    { name: 'Local 50K Trail Ultra', miles: 27 },
    { name: 'Western States 100', miles: 310 },
    { name: 'Leadville 100', miles: 420 },
  ],
};

export const NEARBY_RADIUS_MI = 40;

export const SEED_MATCHES: PartnerMatch[] = [
  { id: 'maya', name: 'Maya Chen', initials: 'MC', pace: 'Steady', distance: '0.6 mi', tags: ['Trail'], status: 'accepted' },
  { id: 'theo', name: 'Theo Grant', initials: 'TG', pace: 'Fast', distance: '1.2 mi', tags: ['Road', 'Early bird'], status: 'pending' },
  { id: 'aria', name: 'Aria Kim', initials: 'AK', pace: 'Easy', distance: '0.9 mi', tags: ['Trail', 'Weekends'], status: 'pending' },
  { id: 'ben', name: 'Ben Okafor', initials: 'BO', pace: 'Steady', distance: '2.1 mi', tags: ['Road'], status: 'pending' },
  { id: 'lucia', name: 'Lucia Fernandez', initials: 'LF', pace: 'Fast', distance: '1.5 mi', tags: ['Trail'], status: 'pending' },
];

export const LEADERBOARD = [
  { rank: 1, name: 'Lucia Fernandez', distance: '38.2 mi', me: false },
  { rank: 2, name: 'You', distance: '31.4 mi', me: true },
  { rank: 3, name: 'Theo Grant', distance: '29.0 mi', me: false },
  { rank: 4, name: 'Maya Chen', distance: '24.6 mi', me: false },
  { rank: 5, name: 'Ben Okafor', distance: '19.8 mi', me: false },
];

export const RUN_HISTORY = [
  { date: 'Jul 22', distance: '4.2 mi', pace: '5:48/mi', duration: '24:22' },
  { date: 'Jul 19', distance: '6.0 mi', pace: '6:10/mi', duration: '37:00' },
  { date: 'Jul 17', distance: '3.1 mi', pace: '5:35/mi', duration: '17:20' },
  { date: 'Jul 14', distance: '5.5 mi', pace: '6:02/mi', duration: '33:11' },
];

export const CHALLENGES = [
  { id: 'c1', title: '50-mile July', desc: 'Log 50 miles before August 1.', progress: 63 },
  { id: 'c2', title: '5-day streak', desc: 'Run five days in a row.', progress: 40 },
  { id: 'c3', title: 'Trail explorer', desc: 'Complete 3 different trail routes.', progress: 100 },
];

export const PROFILE_LIFETIME_STATS = [
  { label: 'Total distance', value: '312 mi' },
  { label: 'Total runs', value: '58' },
  { label: 'Longest streak', value: '11 days' },
  { label: 'Avg. pace', value: '5:52/mi' },
];

export const GARMIN_SAMPLE_ACTIVITIES = [
  { date: 'Jul 25', title: 'Morning Run', distance: '6.2 mi', pace: '8:42/mi', hr: '152 bpm avg' },
  { date: 'Jul 23', title: 'Tempo Run', distance: '4.0 mi', pace: '7:55/mi', hr: '167 bpm avg' },
];

export const ELECTROLYTE_BRANDS = [
  '', 'GU Energy', 'Maurten', 'Honey Stinger', 'SIS (Science in Sport)', 'Skratch Labs', 'Nuun', 'Tailwind', 'LMNT', 'Other',
];

export const NUTRITION_BRANDS = [
  '', 'Clif Bar', 'Honey Stinger Waffle', 'Bonk Breaker', 'Picky Bars', 'Banana', 'Homemade', 'Other',
];

export const LANDING_FEATURES = [
  { title: 'Built For Every Runner', desc: 'From your first 5K to your fiftieth ultra — plans that meet you where you are.' },
  { title: 'Any Distance, Your Choice', desc: '5K to 300-mile ultras, pick your race and we build the plan around it.' },
  { title: 'Upload, Analyze, Train', desc: 'Drop in a GPX file and get route-aware training insights.' },
  { title: 'Fuel Right', desc: 'Nutrition guidance tuned to your mileage and race distance.' },
  { title: 'Stay Ahead of Dehydration', desc: 'Weather-aware hydration recommendations for every run.' },
  { title: 'Gear That Fits Your Run', desc: 'Recommendations tailored to your distance, weather, and terrain.' },
  { title: 'Strength That Supports Speed', desc: 'Targeted strength work to keep you injury-free and running strong.' },
  { title: 'Never Run Alone', desc: 'Get matched with partners and groups who run your pace, your way.' },
];
