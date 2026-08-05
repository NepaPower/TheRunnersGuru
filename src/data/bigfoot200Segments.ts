import segment01 from '../assets/segments/segment-01.png';
import segment02 from '../assets/segments/segment-02.png';
import segment03 from '../assets/segments/segment-03.png';
import segment04 from '../assets/segments/segment-04.png';
import segment05 from '../assets/segments/segment-05.png';
import segment06 from '../assets/segments/segment-06.png';
import segment07 from '../assets/segments/segment-07.png';
import segment08 from '../assets/segments/segment-08.png';
import segment09 from '../assets/segments/segment-09.png';
import segment10 from '../assets/segments/segment-10.png';
import segment11 from '../assets/segments/segment-11.png';
import segment12 from '../assets/segments/segment-12.png';
import segment13 from '../assets/segments/segment-13.png';

export interface CourseSegment {
  title: string;
  distanceMiles: number;
  ascentFt: number;
  descentFt: number;
  description: string;
  profileImage: string;
}

/** BigFoot 200 course segment descriptions and elevation profiles, from
 * the official 2026 Runner's Manual. This is specific, hardcoded data for
 * this one race — matched to the GPX's waypoints purely by ORDER (segment
 * index i is the leg between waypoint i and waypoint i+1), not by name
 * matching, since the manual's segment names ("Road 9327") don't always
 * exactly match the GPX's own waypoint names ("M082-RD 9327"). A future
 * version of this feature could let any race upload its own manual, but
 * reliable docx parsing (mixed text + embedded images, arbitrary
 * structure) in the browser is a meaningfully bigger undertaking than
 * this — this is the concrete, working version for the race actually
 * being run. */
export const BIGFOOT_200_SEGMENTS: CourseSegment[] = [
  {
    title: 'Start to Blue Lake',
    distanceMiles: 12.2,
    ascentFt: 2980,
    descentFt: 2490,
    description:
      "You start the run climbing up historic Mt. St. Helens. Sections range from treed at the start to dry, sandy and even a section with a boulder field. In the boulder field follow the posts and course markers to find your way. Gaiters recommended. Stream at mile 2.5 (silty), 8.4mi (clean), and mi 10.4 (small creek).",
    profileImage: segment01,
  },
  {
    title: 'Blue Lake to Coldwater Lake',
    distanceMiles: 25.2,
    ascentFt: 4002,
    descentFt: 4674,
    description:
      "The section starts out in woods, crosses a river by Blue Lake (the lake not the aid), gently uphill until you descend into a canyon (7.4 miles into section) on fixed ropes, cross knee deep river, and climb fixed ropes. Continue to climb the exposed mountain side. Some trees. Some steep scrambles through dried river beds. River at mile 3.6 (good flowing), at mile 6.2 last chance for non-silty water for 10 miles! The river is just 1/10 off trail (at sharp hairpin turn), mile 7.4 silty large river, mile 14.4 very silty river. Very exposed section with great views of Mt. St. Helens and the path of the volcano eruption that happened in 1980. Feels like you're in another world at times. Lots of small ups and downs. 5-6 extremely overgrown (bushes) sections — short and well marked. Sand dunes and a climb past the Johnston Ridge Observatory bring you to a very runnable and mostly downhill trail.",
    profileImage: segment02,
  },
  {
    title: 'Coldwater Lake to Norway Pass',
    distanceMiles: 18.7,
    ascentFt: 5105,
    descentFt: 3909,
    description:
      "Mostly a runnable section by the lake, make sure you fill up on water at the bridge before you start the steep climb out into the Mount Margaret Backcountry. Incredible views of Loowit, Spirit Lake, Lake Saint Helens, and the blast area. Dusty running, gaiters advised. Best views of the course, recommend running in daylight if possible. Climb up to the summit of Mount Margaret for the high point of the race; it's all downhill from here! Easy descent to Norway Pass.",
    profileImage: segment03,
  },
  {
    title: 'Norway Pass to Elk Pass',
    distanceMiles: 11.1,
    ascentFt: 2037,
    descentFt: 1558,
    description:
      "Climb out from Norway Pass, downed logs in the blast area until Bear Camp. Beautiful forest trails from there to Elk Pass, no large climbs. A few water sources.",
    profileImage: segment04,
  },
  {
    title: 'Elk Pass to Road 9327',
    distanceMiles: 15,
    ascentFt: 2543,
    descentFt: 3144,
    description:
      "Easy climb out from Elk Pass to beautiful ridge meadows, knife ridges, and rocky outcroppings. Stop by Shark Rock for a view of Mount Adams and Rainier. Turn off the Boundary Trail to head south with fun descents, but rutted and dusty in a few areas. No water along the route. Fabulous cold swimming hole at 9327 Aid Station.",
    profileImage: segment05,
  },
  {
    title: 'Road 9327 to Spencer Butte',
    distanceMiles: 11.2,
    ascentFt: 2817,
    descentFt: 2860,
    description:
      "Descend and climb back up to the road, lots of great water sources to cool off. Cross the road and climb up and over Spencer Butte. Fast downhill then climb to the Spencer Butte Aid.",
    profileImage: segment06,
  },
  {
    title: 'Spencer Butte to Lewis River',
    distanceMiles: 7.6,
    ascentFt: 1282,
    descentFt: 2852,
    description:
      "Two paved miles and then a brushy descent down the Bluff Trail for a few more miles. Make sure you watch out for course markings in this area! Once along the Lewis River, enjoy the best groomed trails of your life with plenty of water. Stop along the Lower Falls for a fabulous waterfall view.",
    profileImage: segment07,
  },
  {
    title: 'Lewis River to Quartz Ridge',
    distanceMiles: 17.2,
    ascentFt: 7347,
    descentFt: 4522,
    description:
      "Deep, dark, dank Pacific Northwest trail running at its best. Run along the Quartz Creek with lots of hidden elevation with roller coaster hills. Topo maps do not portray the constant ups and downs in this area. Steep climb out of Quartz Creek to meet back up with the Boundary Trail. Dry ridge up high leading to a descent to the next aid. Water along Quartz Creek, but none after the climb out of the valley. 1.8 miles out and back to the new Quartz Creek Aid location off of 9085 road.",
    profileImage: segment08,
  },
  {
    title: 'Quartz Ridge to Chain of Lakes',
    distanceMiles: 16.2,
    ascentFt: 3846,
    descentFt: 4015,
    description:
      "1.8 miles from new Quartz Ridge aid back to the Boundary Trail #1. Another 8.6 miles until you hit the road. Short climb and descent over Council Bluff with an incredible view of Mt. Adams and Council Lake — the descent takes you to Council Lake, a fantastic swimming hole. Another short climb and descent over Babyshoe Ridge takes you to a two mile paved section. Back on singletrack for a few more miles to end up at Chain of Lakes. Water to filter is only at the lake.",
    profileImage: segment09,
  },
  {
    title: 'Chain of Lakes to Klickitat',
    distanceMiles: 17.3,
    ascentFt: 3927,
    descentFt: 3900,
    description:
      "Descend to Adams River with a log crossing over the river (careful!). Steady climb back up to Horseshoe Lake and rolling terrain over a plain. Three mandatory wet-feet river crossings to your shins (depth varies by year). Descent into the Cispus River valley. Easy crossing of the Cispus. Steep, undulating four mile climb up to the top of Elk Peak (mandatory out and back) makes this section one of the toughest and longest. Look out from Elk Peak at Helens, now so far in the distance, and Adams, once so far away, now so close. Fast descent to Klickitat Aid. The section can be a bit overgrown, but mostly just with huckleberries.",
    profileImage: segment10,
  },
  {
    title: 'Klickitat to Twin Sisters',
    distanceMiles: 19.4,
    ascentFt: 4919,
    descentFt: 4987,
    description:
      "Good climb up to Mission Mountain. The trail becomes faint and disappears for a while here, so pay attention to course markings! Lots of overgrown blueberry plants and brush growing into the trail. Bushwhacking, tree hurdling, exposure and lots of technical terrain make this section notorious and especially tough. Incredible views along the way. After Monument Rock, the trail becomes a Bigfoot Game Trail. Stay positive and don't let the downed logs and rough trail mess with your spirits. Cool off in Saint John and Jackpot Lake. After Jackpot Lake, the trail improves dramatically into Twin Sisters. You'll take a 2.7 mile out and back to Twin Sisters Aid at mile 16.7.",
    profileImage: segment11,
  },
  {
    title: "Twin Sisters to Owen's Creek",
    distanceMiles: 16,
    ascentFt: 2592,
    descentFt: 4760,
    description:
      "Climb back up to the No. 7 Klickitat Trail from Twin Sisters Aid on the 2.7 mile out-and-back, mostly uphill, sometimes steeply, until you get to the Klickitat/No. 7 trail. Enjoy incredible ridge views on a mostly descending section. Mandatory out-and-back to Pompey Peak (0.2 mi one way). The trail becomes overgrown with downed trees about 2 miles before Pompey Peak and afterward as well. Near the end of this section, the trail widens into what was once a road, known as the Green Tunnel. Cross a couple washes then you are at Owen's Creek Aid.",
    profileImage: segment12,
  },
  {
    title: "Owen's Creek to Finish",
    distanceMiles: 13,
    ascentFt: 385,
    descentFt: 1639,
    description:
      "From aid, you will mostly descend on FS roads until you get to Cline Road (left) and follow that to a right on Cispus Road and then a right on HWY 131, bringing you right into Randle. Cross HWY 12 onto Silverbrook Road. You are very close to the finish. Just past Kehoe Rd, you'll turn into White Pass High School and finish 3/4 a lap on the track.",
    profileImage: segment13,
  },
];
