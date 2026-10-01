/* Road Ready - Great Britain (DVSA car theory) pack.
 *
 * A jurisdiction module data file: the region fact table plus its full
 * question bank, both cited against SOURCE_REGISTRY in js/state-packs.js.
 *
 * Every question here is jurisdiction-tagged [UK] and therefore MUST carry
 * sourceId + sourceSection + a kebab-case concept. The content QA system
 * (scripts/content-checks.mjs) enforces that, cross-checks numeric claims
 * against the fact table below, and rebalances answer position and wording
 * similarity across the whole bank. Run: npm run validate
 *
 * Local vocabulary only: drive on the left, mph, give way, provisional
 * licence. Nothing from the US bank may appear here.
 */
/* exported ROADREADY_UK_PACK */
"use strict";


const ROADREADY_UK_PACK = {
  "id": "UK",
  "includeUniversal": false,
  "name": "Great Britain (DVSA car)",
  "sourceId": "uk-highway-code",
  "facts": {
    "bacAdult": "35 microgrammes per 100ml breath in England and Wales; 22 in Scotland",
    "bacUnder21": "No separate under-21 limit: the same regional adult limit applies (35 England/Wales; 22 Scotland)",
    "rightOnRed": "Not applicable — drive on the left; never pass a red light",
    "followDistance": "2-second rule in dry conditions (at least 4 seconds in the wet)",
    "speedResidential": "30 mph in England and Scotland; 20 mph in Wales on lit built-up roads unless signs show otherwise",
    "speedUrban": "60 mph single carriageway / 70 mph dual carriageway and motorway (cars)",
    "bikePassing": "At least 1.5 metres when overtaking cyclists at up to 30 mph (more at higher speeds)",
    "handsFree": "Hand-held phone ban — 6 points and £200 fine",
    "theoryFormat": "50 questions in 57 minutes, 43 to pass",
    "hazardFormat": "14 clips, 15 hazards, 44 out of 75 to pass"
  },
  "questions": [
    {
      "id": "uk-001",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "national-speed-limit-sign",
      "q": "You see a white circular sign with a single black diagonal bar. What does it mean?",
      "choices": [
        "National speed limit applies",
        "End of motorway",
        "No overtaking",
        "Minimum speed limit"
      ],
      "a": 0,
      "why": "The white circle with a black diagonal is the national-speed-limit sign: the default maximum for that road class applies. On lit built-up roads that still means 30 mph unless signs say otherwise.",
      "sourceId": "uk-know-your-traffic-signs",
      "sourceSection": "Speed limit signs"
    },
    {
      "id": "uk-002",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "warning-vs-order-signs",
      "q": "In the UK sign system, what is the difference between a red triangle and a red circle?",
      "choices": [
        "Triangles give orders, circles warn",
        "Triangles warn of hazards ahead; circles give orders you must obey",
        "Circles are advisory only",
        "There is no difference"
      ],
      "a": 1,
      "why": "Shape carries the meaning: red triangles warn of hazards ahead, while red circles give prohibitive orders. Learning the shape system lets you react before reading the symbol.",
      "sourceId": "uk-know-your-traffic-signs",
      "sourceSection": "Sign shapes"
    },
    {
      "id": "uk-003",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "speed-limits",
      "q": "A car on a UK single carriageway with no other limit signed may travel at up to:",
      "choices": [
        "50 mph",
        "60 mph",
        "70 mph",
        "40 mph"
      ],
      "a": 1,
      "why": "The national limit for cars on a single carriageway is 60 mph. Dual carriageways and motorways allow 70 mph for cars; built-up lit roads default to 30 mph.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits"
    },
    {
      "id": "uk-004",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "speed-limits",
      "q": "In England or Scotland, a lit built-up road has no signs showing a different limit. What limit generally applies?",
      "choices": [
        "20 mph",
        "40 mph",
        "60 mph",
        "30 mph"
      ],
      "a": 3,
      "why": "In England and Scotland, 30 mph generally applies on roads with street lights unless signs show otherwise. In Wales, the equivalent default is generally 20 mph.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits"
    },
    {
      "id": "uk-005",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "roundabout-priority",
      "q": "At a UK roundabout with no traffic lights, you must give way to:",
      "choices": [
        "Traffic from your left",
        "Traffic from your right",
        "Cyclists behind you only",
        "Nobody — first to enter wins"
      ],
      "a": 1,
      "why": "Give way to traffic coming from your right, circulating on the roundabout. The Highway Code rule is explicit: priority goes to the right on UK roundabouts.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Roundabouts"
    },
    {
      "id": "uk-006",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "zebra-crossing",
      "q": "A pedestrian steps onto a zebra crossing ahead of you. You must:",
      "choices": [
        "Wave them back and drive through",
        "Sound the horn and continue",
        "Stop and let them cross",
        "Overtake on the zig-zags if clear"
      ],
      "a": 2,
      "why": "Zebra crossings give pedestrians priority once they step on: stop at the give-way line and wait. Overtaking and parking on the zig-zag lines is banned because it hides people crossing.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Pedestrian crossings"
    },
    {
      "id": "uk-007",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "bike-passing-distance",
      "q": "Overtaking a cyclist at up to 30 mph, the Highway Code says leave at least:",
      "choices": [
        "0.5 metres",
        "1.5 metres",
        "3 metres",
        "Whatever feels close enough"
      ],
      "a": 1,
      "why": "Leave AT LEAST 1.5 METRES when passing cyclists at up to 30 mph, and more space at higher speeds. Close passes are a leading cause of cyclist injuries.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Overtaking cyclists"
    },
    {
      "id": "uk-008",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "following-distance",
      "q": "In dry conditions on a UK road, the recommended gap to the vehicle ahead is:",
      "choices": [
        "A 1-second gap",
        "A 2-second gap",
        "A 5-second gap",
        "One car length at any speed"
      ],
      "a": 1,
      "why": "Use the 2-SECOND rule in the dry: pick a fixed point and count two seconds after the vehicle ahead passes it. Double the gap to at least 4 seconds when wet.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Stopping distances"
    },
    {
      "id": "uk-009",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "phone-use",
      "q": "Caught using a hand-held phone while driving in the UK, you face:",
      "choices": [
        "A warning letter only",
        "An instant driving ban in all cases",
        "No penalty if stationary at lights",
        "6 penalty points and a £200 fine"
      ],
      "a": 3,
      "why": "Hand-held use is banned even when stopped at lights or in queues: the penalty is 6 POINTS and a £200 FINE. New drivers can lose their licence on 6 points within two years of passing.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Mobile phones"
    },
    {
      "id": "uk-010",
      "cat": "alcohol",
      "jurisdiction": [
        "UK"
      ],
      "concept": "bac-limits",
      "q": "The drink-drive breath limit in England and Wales is:",
      "choices": [
        "15 microgrammes per 100ml",
        "25 microgrammes per 100ml",
        "35 microgrammes per 100ml",
        "80 microgrammes per 100ml"
      ],
      "a": 2,
      "why": "England and Wales set the breath limit at 35 MICROGRAMMES of alcohol per 100ml of breath. Scotland is stricter at 22. Any amount impairs driving — the limit is a legal ceiling, not a safe target.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Drink and drugs"
    },
    {
      "id": "uk-011",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "motorway-lanes",
      "q": "On a UK motorway you should normally drive in:",
      "choices": [
        "The right-hand lane",
        "The left-hand lane, overtaking on the right",
        "The hard shoulder",
        "Whichever lane is emptiest, weaving as needed"
      ],
      "a": 1,
      "why": "Keep left unless overtaking: the left-hand lane is the driving lane and you pass on the right. Middle-lane hogging can draw a careless-driving penalty.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Motorways"
    },
    {
      "id": "uk-012",
      "cat": "alcohol",
      "jurisdiction": [
        "UK"
      ],
      "concept": "bac-limits",
      "q": "What is the legal breath-alcohol limit for drivers in Scotland?",
      "choices": [
        "22 microgrammes per 100ml",
        "35 microgrammes per 100ml",
        "50 microgrammes per 100ml",
        "80 microgrammes per 100ml"
      ],
      "a": 0,
      "why": "Scotland has a lower limit than England and Wales: 22 MICROGRAMMES of alcohol per 100ml of breath, compared with 35 in England and Wales.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Alcohol and drugs — Rule 95"
    },
    {
      "id": "uk-013",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "traffic-lights-red-amber",
      "q": "At traffic lights, red and amber are showing together. What should you do?",
      "choices": [
        "Stay stopped and wait for green",
        "Move off if no traffic is coming",
        "Prepare to turn only",
        "Proceed slowly through the junction"
      ],
      "a": 0,
      "why": "Red and amber still mean stop. Do not cross the stop line or start moving until green shows.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Light signals controlling traffic"
    },
    {
      "id": "uk-014",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "motorway-red-x",
      "q": "A red X is displayed above your motorway lane. What does it mean?",
      "choices": [
        "The lane is for overtaking only",
        "The lane is closed and you must move to an open lane",
        "The speed limit has ended",
        "The hard shoulder is open"
      ],
      "a": 1,
      "why": "A red X marks a closed lane. Follow the signs into an open lane and do not drive in the closed lane.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Motorways — Rule 258"
    },
    {
      "id": "uk-015",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "headlight-flash",
      "q": "What is the correct meaning of flashing your headlights at another road user?",
      "choices": [
        "You are giving them priority",
        "They should speed up",
        "You are making them aware that you are there",
        "You are telling them the road is clear"
      ],
      "a": 2,
      "why": "The Highway Code says headlight flashes should only be used to let other road users know you are there, not as an invitation to proceed.",
      "sourceId": "uk-highway-code",
      "sourceSection": "General rules — Rules 110 to 111"
    },
    {
      "id": "uk-016",
      "cat": "signs",
      "jurisdiction": [
        "UK"
      ],
      "concept": "blue-circle-sign",
      "q": "What does a blue circular traffic sign usually mean in Great Britain?",
      "choices": [
        "A warning of danger ahead",
        "A tourist attraction",
        "A temporary diversion",
        "A positive mandatory instruction or a route for specified traffic"
      ],
      "a": 3,
      "why": "Blue circles generally give positive instructions, such as turning in a stated direction, or indicate a route reserved for specified classes of traffic.",
      "sourceId": "uk-know-your-traffic-signs",
      "sourceSection": "The signing system"
    },
    {
      "id": "uk-017",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "hazard-warning-line",
      "q": "A broken white centre line becomes longer with shorter gaps. What should you expect?",
      "choices": [
        "A hazard ahead",
        "A motorway is beginning",
        "Parking is permitted",
        "The road becomes one-way"
      ],
      "a": 0,
      "why": "Longer centre-line markings with shorter gaps warn that a hazard is ahead, so reassess speed and visibility before crossing the line.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Lines and lane markings — Rule 127"
    },
    {
      "id": "uk-018",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "solid-double-white",
      "q": "The white line nearest you in a double-white-line system is solid. What is the general rule?",
      "choices": [
        "You may cross it whenever traffic is light",
        "You must not cross or straddle it except for specific permitted situations",
        "You must drive on the line",
        "It marks a bus lane"
      ],
      "a": 1,
      "why": "A solid white line nearest you generally must not be crossed or straddled, with only limited exceptions set out in the Highway Code.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Lines and lane markings — Rule 129"
    },
    {
      "id": "uk-019",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "solid-chevron-area",
      "q": "A chevron area is bordered by solid white lines. When may you enter it?",
      "choices": [
        "Whenever you are overtaking",
        "To queue for a right turn",
        "Only in an emergency",
        "Whenever the lane beside it is busy"
      ],
      "a": 2,
      "why": "Chevron areas bordered by solid white lines must not be entered except in an emergency.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Lines and lane markings — Rule 130"
    },
    {
      "id": "uk-020",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "road-studs-amber",
      "q": "On a motorway or dual carriageway, what do amber reflective road studs mark?",
      "choices": [
        "The left edge of the road",
        "A slip-road edge",
        "Temporary road works only",
        "The central reservation"
      ],
      "a": 3,
      "why": "Amber studs mark the central reservation. Red marks the left edge, while green is used at lay-bys and slip roads.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Lines and lane markings — Rule 132"
    },
    {
      "id": "uk-021",
      "cat": "markings",
      "jurisdiction": [
        "UK"
      ],
      "concept": "double-yellow-lines",
      "q": "What do double yellow lines normally mean?",
      "choices": [
        "No waiting at any time",
        "No overtaking",
        "No entry for cars",
        "Parking for permit holders only"
      ],
      "a": 0,
      "why": "Double yellow lines indicate a prohibition of waiting at any time, unless signs specifically show a seasonal exception.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Waiting and parking — Rule 238"
    },
    {
      "id": "uk-022",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "junction-pedestrian-priority",
      "q": "You are turning into a side road where a pedestrian is waiting to cross. What should you do?",
      "choices": [
        "Turn before they step out",
        "Sound your horn so they wait",
        "Give way to the pedestrian",
        "Only give way if there is a zebra crossing"
      ],
      "a": 2,
      "why": "At junctions, drivers should give way to pedestrians crossing or waiting to cross a road into which or from which they are turning.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Using the road — Rule 170"
    },
    {
      "id": "uk-023",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "indicator-not-guarantee",
      "q": "A vehicle approaching from your right is signalling left as you wait at a junction. What is safest?",
      "choices": [
        "Pull out immediately",
        "Assume it will stop",
        "Wait until you are satisfied it is actually turning",
        "Flash your headlights and go"
      ],
      "a": 2,
      "why": "Do not assume a signal is reliable or has been cancelled correctly. Wait until you are satisfied the vehicle is really turning before emerging.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Using the road — Rule 170"
    },
    {
      "id": "uk-024",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "mini-roundabout",
      "q": "At a mini-roundabout, how should you treat the central marking?",
      "choices": [
        "Drive across it to shorten your route",
        "Stop on it before turning right",
        "Ignore it when the road is quiet",
        "Pass around it unless your vehicle is physically unable to do so"
      ],
      "a": 3,
      "why": "Vehicles must pass around the central markings of a mini-roundabout, except large vehicles that are physically incapable of doing so.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Using the road — Rule 188"
    },
    {
      "id": "uk-025",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "green-light-clear-way",
      "q": "Your traffic light turns green but the junction ahead is blocked. What should you do?",
      "choices": [
        "Wait until there is space to proceed safely",
        "Enter the junction because green gives priority",
        "Use the horn until traffic moves",
        "Move into the junction and stop there"
      ],
      "a": 0,
      "why": "A green signal is permission to proceed only when the route through the junction is clear. If traffic is blocking your exit, remain behind the line rather than entering and becoming an obstruction.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Light signals controlling traffic"
    },
    {
      "id": "uk-026",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "authorised-person-signals",
      "q": "A uniformed traffic officer signals you to stop. What must you do?",
      "choices": [
        "Continue if the traffic light is green",
        "Obey the signal and stop when safe",
        "Stop only if a police car is present",
        "Ignore it on a dual carriageway"
      ],
      "a": 1,
      "why": "Drivers must obey lawful signals from authorised officers, including police, traffic officers and DVSA officers.",
      "sourceId": "uk-highway-code",
      "sourceSection": "General rules — Rules 105 to 108"
    },
    {
      "id": "uk-027",
      "cat": "row",
      "jurisdiction": [
        "UK"
      ],
      "concept": "roundabout-cyclist-space",
      "q": "A cyclist is continuing around a roundabout in the left-hand lane. What should you do?",
      "choices": [
        "Pass within the same lane",
        "Cut across before they reach your exit",
        "Give them room and do not cut across their path",
        "Sound the horn so they move left"
      ],
      "a": 2,
      "why": "Cyclists may remain in the left-hand lane while continuing around a roundabout. Drivers should give them space and avoid cutting across their path.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Using the road — Rule 185"
    },
    {
      "id": "uk-028",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "wales-built-up-speed",
      "q": "In Wales, what speed limit generally applies to a lit built-up road when signs do not show a different limit?",
      "choices": [
        "30 mph",
        "40 mph",
        "60 mph",
        "20 mph"
      ],
      "a": 3,
      "why": "In Wales, 20 mph generally applies on roads with street lights unless signs show a different limit.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits — Rule 124"
    },
    {
      "id": "uk-029",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "speed-limit-not-target",
      "q": "A road is signed at 60 mph, but visibility is poor. What does the 60 mph sign mean?",
      "choices": [
        "60 mph is the maximum, not a target; you may need to drive slower",
        "You must stay as close to 60 mph as possible",
        "You may exceed 60 mph while overtaking",
        "The limit applies only in dry weather"
      ],
      "a": 0,
      "why": "A speed limit is an absolute maximum, not a target. Drivers should reduce speed when road, traffic, visibility or weather conditions require it.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits — Rule 125"
    },
    {
      "id": "uk-030",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "trailer-single-carriageway-speed",
      "q": "What is the national speed limit for a car towing a trailer on a single carriageway?",
      "choices": [
        "60 mph",
        "70 mph",
        "40 mph",
        "50 mph"
      ],
      "a": 3,
      "why": "Cars towing trailers are limited to 50 mph on single carriageways under the national speed-limit table.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits — Rule 124"
    },
    {
      "id": "uk-031",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "trailer-motorway-speed",
      "q": "What is the national maximum for a car towing a trailer on a motorway?",
      "choices": [
        "70 mph",
        "50 mph",
        "60 mph",
        "80 mph"
      ],
      "a": 2,
      "why": "Cars towing caravans or trailers are limited to 60 mph on motorways and dual carriageways.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Speed limits — Rule 124"
    },
    {
      "id": "uk-032",
      "cat": "speed",
      "jurisdiction": [
        "UK"
      ],
      "concept": "icy-stopping-distance",
      "q": "Compared with a dry road, how much greater can stopping distance be on ice?",
      "choices": [
        "About the same",
        "Up to twice as great",
        "Up to five times as great",
        "Up to ten times as great"
      ],
      "a": 3,
      "why": "The Highway Code warns that stopping distances on icy roads can be up to ten times greater than on dry roads.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Driving in adverse weather — Rule 230"
    },
    {
      "id": "uk-033",
      "cat": "parking",
      "jurisdiction": [
        "UK"
      ],
      "concept": "parking-crossing-zigzags",
      "q": "May you park on the zig-zag markings at a pedestrian crossing?",
      "choices": [
        "No, parking there is prohibited",
        "Yes, for up to five minutes",
        "Only after dark",
        "Only with hazard lights on"
      ],
      "a": 0,
      "why": "Parking is prohibited on a pedestrian crossing and in the area covered by its zig-zag lines because a parked vehicle can hide pedestrians from approaching traffic.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Pedestrian crossings — Rule 191"
    },
    {
      "id": "uk-034",
      "cat": "parking",
      "jurisdiction": [
        "UK"
      ],
      "concept": "parking-near-junction",
      "q": "Unless you are in an authorised parking space, how close should you avoid parking to a junction?",
      "choices": [
        "Within 2 metres",
        "Within 10 metres",
        "Within 25 metres",
        "Within 50 metres"
      ],
      "a": 1,
      "why": "The Highway Code says not to stop or park opposite or within 10 metres of a junction, except in an authorised parking space.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Waiting and parking — Rule 243"
    },
    {
      "id": "uk-035",
      "cat": "parking",
      "jurisdiction": [
        "UK"
      ],
      "concept": "night-parking-direction",
      "q": "At night, when may you park facing against the direction of traffic flow?",
      "choices": [
        "Whenever your sidelights are on",
        "On any road below 30 mph",
        "Only in a recognised parking space",
        "Whenever the road is empty"
      ],
      "a": 2,
      "why": "At night you must not park facing against the traffic flow unless you are in a recognised parking space.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Waiting and parking — Rule 248"
    },
    {
      "id": "uk-036",
      "cat": "parking",
      "jurisdiction": [
        "UK"
      ],
      "concept": "parking-lights-high-speed-road",
      "q": "Your car is parked at night on a road with a speed limit above 30 mph. What is required?",
      "choices": [
        "Hazard lights must flash all night",
        "No lights are needed if you are near the kerb",
        "Main beam headlights must stay on",
        "Parking lights must be displayed"
      ],
      "a": 3,
      "why": "Vehicles parked at night on a road or lay-by with a speed limit above 30 mph must display parking lights.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Waiting and parking — Rule 249"
    },
    {
      "id": "uk-037",
      "cat": "parking",
      "jurisdiction": [
        "UK"
      ],
      "concept": "hill-parking-downhill",
      "q": "When parking facing downhill on a hill, which way should you turn the steering wheel?",
      "choices": [
        "Towards the kerb",
        "Away from the kerb",
        "Keep the wheels straight",
        "It does not matter if the handbrake is on"
      ],
      "a": 0,
      "why": "When facing downhill, the Highway Code says to select reverse gear and turn the wheels towards the kerb; when facing uphill, turn them away from the kerb.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Waiting and parking — Rule 252"
    },
    {
      "id": "uk-038",
      "cat": "alcohol",
      "jurisdiction": [
        "UK"
      ],
      "concept": "medicines-and-driving",
      "q": "A medicine may make you drowsy or impair your driving. What should you do?",
      "choices": [
        "Drive only on quiet roads",
        "Check with a doctor or pharmacist and do not drive if advised you may be impaired",
        "Take extra caffeine and continue",
        "Ignore the warning if the medicine is prescribed"
      ],
      "a": 1,
      "why": "The Highway Code says you must not drive under the influence of drugs or medicine. Check with a doctor or pharmacist and do not drive if you may be impaired.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Rules for drivers — Rule 96"
    },
    {
      "id": "uk-039",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "tired-driving-break",
      "q": "On a long journey, what minimum break does the Highway Code recommend after every two hours of driving?",
      "choices": [
        "5 minutes",
        "10 minutes",
        "At least 15 minutes",
        "30 minutes"
      ],
      "a": 2,
      "why": "To reduce fatigue risk, the Highway Code recommends planning a minimum break of at least 15 minutes after every two hours of driving.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Rules for drivers — Rule 91"
    },
    {
      "id": "uk-040",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "fog-light-use",
      "q": "When should front or rear fog lights be used?",
      "choices": [
        "Whenever it is raining",
        "Whenever you are on a motorway",
        "At night on every unlit road",
        "Only when visibility is seriously reduced, and they should be switched off when it improves"
      ],
      "a": 3,
      "why": "Fog lights may be used when visibility is seriously reduced, generally below about 100 metres, and must be switched off when visibility improves.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Driving in adverse weather — Rules 226 and 236"
    },
    {
      "id": "uk-041",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "wet-stopping-distance",
      "q": "In wet weather, how should you expect stopping distance to compare with dry conditions?",
      "choices": [
        "It can be at least double",
        "It is usually shorter",
        "It stays exactly the same",
        "It is only longer below 30 mph"
      ],
      "a": 0,
      "why": "Wet roads reduce tyre grip, so stopping distances will be at least double those required on dry roads.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Driving in adverse weather — Rule 227"
    },
    {
      "id": "uk-042",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "hazard-warning-lights-moving",
      "q": "When may hazard warning lights be used while a vehicle is moving?",
      "choices": [
        "Whenever traffic is slow",
        "On a motorway or unrestricted dual carriageway to warn following drivers of a hazard or obstruction ahead",
        "Whenever a driver wants to stop briefly",
        "Every time a vehicle overtakes"
      ],
      "a": 1,
      "why": "While moving, hazard warning lights are only for a motorway or unrestricted dual carriageway when warning drivers behind of a hazard or obstruction ahead.",
      "sourceId": "uk-highway-code",
      "sourceSection": "General rules — Rule 116"
    },
    {
      "id": "uk-043",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "rear-facing-seat-airbag",
      "q": "Where must a rear-facing baby seat not be fitted?",
      "choices": [
        "On a rear seat with a head restraint",
        "On a seat with a three-point belt",
        "In front of an active frontal airbag",
        "Next to a window"
      ],
      "a": 2,
      "why": "A rear-facing baby seat must not be fitted where an active frontal airbag protects that seat because deployment can cause serious injury.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Rules for drivers — Rule 101"
    },
    {
      "id": "uk-044",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "collision-casualty-movement",
      "q": "After a collision, when should an injured casualty normally be moved from a vehicle?",
      "choices": [
        "As soon as another driver arrives",
        "Immediately, to make them comfortable",
        "Before calling emergency services",
        "Only if there is a threat of further danger"
      ],
      "a": 3,
      "why": "The Highway Code first-aid guidance says not to move casualties from vehicles unless there is a threat of further danger.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Annex 7 — First aid on the road"
    },
    {
      "id": "uk-045",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "seriously-reduced-visibility-headlights",
      "q": "Visibility drops below about 100 metres in heavy fog. What lighting is required?",
      "choices": [
        "Headlights",
        "Parking lights only",
        "Hazard lights continuously",
        "No lights during daylight"
      ],
      "a": 0,
      "why": "Headlights must be used when visibility is seriously reduced, generally when you cannot see for more than 100 metres.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Driving in adverse weather — Rule 226"
    },
    {
      "id": "uk-046",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "motorway-breakdown-safer-place",
      "q": "A vehicle develops a problem on a motorway but can still reach a safer stopping place. What does the Highway Code advise?",
      "choices": [
        "Stop in the live lane",
        "Leave at the next exit or pull into a service area if possible",
        "Reverse to the previous exit",
        "Stop on the central reservation"
      ],
      "a": 1,
      "why": "If possible, leave the motorway at the next exit or reach a service area, which is safer than stopping close to high-speed traffic.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Breakdowns and incidents — Rule 277"
    },
    {
      "id": "uk-047",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "hierarchy-road-users",
      "q": "Under the Highway Code hierarchy of road users, who has the greatest responsibility to reduce danger?",
      "choices": [
        "The person travelling fastest",
        "The person who arrived first",
        "The road users who can cause the greatest harm",
        "Only professional drivers"
      ],
      "a": 2,
      "why": "The hierarchy says road users who can cause the greatest harm have the greatest responsibility to reduce the danger they pose to others.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Introduction — Hierarchy of road users"
    },
    {
      "id": "uk-048",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "horse-passing-distance",
      "q": "When passing a horse rider, what guide does the Highway Code give?",
      "choices": [
        "Pass at up to 30 mph with 1 metre",
        "Sound the horn and pass quickly",
        "Use the opposite verge if needed",
        "Pass at under 10 mph and allow at least 2 metres of space"
      ],
      "a": 3,
      "why": "When passing horse riders or horse-drawn vehicles, the Highway Code advises speeds under 10 mph and at least 2 metres of space.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Using the road — Rule 163"
    },
    {
      "id": "uk-049",
      "cat": "vehicle",
      "jurisdiction": [
        "UK"
      ],
      "concept": "tyre-tread-depth",
      "q": "What is the minimum legal tyre tread depth for a car across the central three-quarters of the tread?",
      "choices": [
        "1.6 mm",
        "1.0 mm",
        "2.5 mm",
        "3.0 mm"
      ],
      "a": 0,
      "why": "Cars and light vans must have at least 1.6 mm of tread across the central three-quarters of the tyre and around the entire circumference.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Annex 6 — Tyres"
    },
    {
      "id": "uk-050",
      "cat": "vehicle",
      "jurisdiction": [
        "UK"
      ],
      "concept": "tyre-pressure-check",
      "q": "When is the best time to check tyre pressures?",
      "choices": [
        "Immediately after a long motorway journey",
        "Only when a warning light appears",
        "After washing the vehicle",
        "Before a journey while the tyres are cold"
      ],
      "a": 3,
      "why": "The Highway Code advises checking tyre pressures weekly, before a journey and while the tyres are cold because warm tyres can give a misleading reading.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Annex 6 — Tyre pressures"
    },
    {
      "id": "uk-051",
      "cat": "vehicle",
      "jurisdiction": [
        "UK"
      ],
      "concept": "warning-lights",
      "q": "A warning light that normally goes out after the engine starts stays illuminated. What should you do?",
      "choices": [
        "Cover it so it does not distract you",
        "Drive faster to recharge the system",
        "Stop and investigate the problem safely",
        "Ignore it until the next service"
      ],
      "a": 2,
      "why": "Warning lights that stay on or appear while driving can indicate a serious fault. Stop safely and investigate rather than ignoring them.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Annex 6 — Warning displays"
    },
    {
      "id": "uk-052",
      "cat": "vehicle",
      "jurisdiction": [
        "UK"
      ],
      "concept": "secure-load",
      "q": "Before driving with luggage in the vehicle, what should you do?",
      "choices": [
        "Put heavy items on the parcel shelf",
        "Leave loose items where they can be reached",
        "Place everything on the front passenger seat",
        "Securely stow the luggage"
      ],
      "a": 3,
      "why": "Items of luggage should be securely stowed so they cannot move around the vehicle or become dangerous in sudden braking or a collision.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Annex 6 — Vehicle maintenance"
    },
    {
      "id": "uk-053",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "eyesight-number-plate",
      "q": "In good daylight, from what distance must a driver be able to read a modern vehicle number plate?",
      "choices": [
        "20 metres",
        "10 metres",
        "30 metres",
        "50 metres"
      ],
      "a": 0,
      "why": "Drivers must be able to read a modern number plate in good daylight from 20 metres, wearing any glasses or contact lenses needed for driving.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Rules for drivers — Rule 92"
    },
    {
      "id": "uk-054",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "missed-motorway-exit",
      "q": "You miss your motorway exit. What should you do?",
      "choices": [
        "Reverse along the hard shoulder",
        "Continue to the next exit",
        "Make a U-turn through the central reservation",
        "Stop and wait for a gap to reverse"
      ],
      "a": 1,
      "why": "You must not reverse, cross the central reservation or drive against traffic on a motorway. If you miss an exit, continue to the next one.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Motorways — Rule 263"
    },
    {
      "id": "uk-055",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "hard-shoulder-use",
      "q": "When may you normally use a motorway hard shoulder?",
      "choices": [
        "Whenever traffic is slow",
        "To make a phone call",
        "Only in an emergency or when directed by police, traffic officers or signs",
        "To overtake a slow vehicle"
      ],
      "a": 2,
      "why": "The hard shoulder must not be used except in an emergency or when directed by police, traffic officers or traffic signs.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Motorways — Rule 269"
    },
    {
      "id": "uk-056",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "emergency-area-use",
      "q": "What are motorway emergency areas for?",
      "choices": [
        "Routine rest breaks",
        "Loading passengers",
        "Checking a route on your phone",
        "Emergencies only"
      ],
      "a": 3,
      "why": "Emergency areas are for emergencies only. They are marked by blue signs with an orange SOS telephone symbol and may have orange surfacing.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Motorways — Rule 270"
    },
    {
      "id": "uk-057",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "cyclist-primary-position",
      "q": "Why might a cyclist ride in the centre of the lane on a narrow road or near a junction?",
      "choices": [
        "It can be the safest position for visibility and space",
        "They are required to block overtaking",
        "It means they are turning right",
        "It is only allowed at night"
      ],
      "a": 0,
      "why": "Cyclists may ride in the centre of a lane on narrow roads, quiet streets, near junctions or in slower traffic because it can help them see, be seen and avoid unsafe close passes.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Road users requiring extra care — Rule 213"
    },
    {
      "id": "uk-058",
      "cat": "vulnerable",
      "jurisdiction": [
        "UK"
      ],
      "concept": "passing-animals",
      "q": "When passing animals on the road, what should you avoid?",
      "choices": [
        "Reducing speed",
        "Sounding the horn or revving the engine",
        "Leaving extra room",
        "Being ready to stop"
      ],
      "a": 1,
      "why": "Drive slowly around animals, give them room and be ready to stop. Do not frighten them by sounding the horn, revving or accelerating sharply.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Road users requiring extra care — Rule 214"
    },
    {
      "id": "uk-059",
      "cat": "laws",
      "jurisdiction": [
        "UK"
      ],
      "concept": "pre-drive-documents",
      "q": "Before setting off, what must you ensure about your authority to drive the vehicle?",
      "choices": [
        "You have a valid licence and insurance for that vehicle",
        "You have owned the vehicle for at least a week",
        "You have a printed map in the glovebox",
        "You have paid for roadside assistance"
      ],
      "a": 0,
      "why": "Before setting off, you must ensure that you have a valid driving licence and insurance for the vehicle you intend to use.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Before setting off — Rule 97"
    },
    {
      "id": "uk-060",
      "cat": "safety",
      "jurisdiction": [
        "UK"
      ],
      "concept": "seat-belt-use",
      "q": "A seat belt is fitted to your seat in a car. What is the general rule?",
      "choices": [
        "Use it only on roads above 30 mph",
        "Use it only on long journeys",
        "You must wear it unless a specific exemption applies",
        "It is optional for adult passengers"
      ],
      "a": 2,
      "why": "Where a seat belt is fitted, it must generally be worn. The Highway Code lists limited legal exemptions, but ordinary journeys are not exempt.",
      "sourceId": "uk-highway-code",
      "sourceSection": "Seat belts and child restraints — Rule 99"
    }
  ]
};

if (typeof module !== "undefined" && module.exports) module.exports = ROADREADY_UK_PACK;
