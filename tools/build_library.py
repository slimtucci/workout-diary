"""Generates exercises-library.js: SlimTucci's built-in exercise movement library.
Names are standard gym naming, cross-checked against ExRx.net's exercise directory and the
public-domain free-exercise-db (github.com/yuhonas/free-exercise-db). Run: python3 tools/build_library.py"""
import json, re, sys, os

CATS = [
  ("push", "Push"), ("pull", "Pull"), ("legs", "Legs"), ("core", "Core"),
  ("power", "Power & Plyo"), ("carry", "Carries & Strongman"), ("cardio", "Cardio & Conditioning"),
  ("agility", "Agility & Lateral"), ("mobility", "Mobility"), ("stretch", "Stretching"),
]
# (category key, sub-group): [names]. Optional "Name|Equipment" overrides inferred equipment.
DATA = {
 ("push", "Chest"): """Barbell Bench Press; Close-Grip Barbell Bench Press; Paused Barbell Bench Press; Incline Barbell Bench Press;
  Decline Barbell Bench Press; Floor Press; Spoto Press; Pin Press; Board Press; Smith Machine Bench Press; Smith Machine Incline Press;
  Dumbbell Bench Press; Incline Dumbbell Bench Press; Decline Dumbbell Bench Press; Single-Arm Dumbbell Bench Press; Alternating Dumbbell Bench Press;
  Neutral-Grip Dumbbell Bench Press; Dumbbell Floor Press; Single-Arm Dumbbell Floor Press; Dumbbell Squeeze Press; Dumbbell Fly; Incline Dumbbell Fly;
  Kettlebell Floor Press; Single-Arm Kettlebell Floor Press; Cable Fly; High-to-Low Cable Fly; Low-to-High Cable Fly; Single-Arm Cable Fly;
  Standing Cable Chest Press; Single-Arm Cable Chest Press; Machine Chest Press; Incline Machine Chest Press; Pec Deck Fly; Hammer Strength Chest Press|Machine;
  Push-Up; Wide Push-Up; Diamond Push-Up; Incline Push-Up; Decline Push-Up; Deficit Push-Up; Archer Push-Up; Weighted Push-Up;
  Band-Resisted Push-Up; Single-Arm Push-Up; Ring Push-Up|Rings; Chest Dip; Weighted Dip; Ring Dip|Rings; Landmine Chest Press; Svend Press|Plate""",
 ("push", "Shoulders"): """Barbell Overhead Press; Push Press; Behind-the-Neck Press; Z Press; Seated Barbell Shoulder Press; Dumbbell Shoulder Press;
  Seated Dumbbell Shoulder Press; Single-Arm Dumbbell Shoulder Press; Arnold Press; Kettlebell Overhead Press; Single-Arm Kettlebell Press;
  Bottoms-Up Kettlebell Press; Half-Kneeling Single-Arm Press|Dumbbell; Landmine Press; Single-Arm Landmine Press; Half-Kneeling Landmine Press;
  Landmine Push Press; Machine Shoulder Press; Smith Machine Shoulder Press; Pike Push-Up; Handstand Push-Up; Wall Walk;
  Dumbbell Lateral Raise; Cable Lateral Raise; Machine Lateral Raise; Lean-Away Lateral Raise|Dumbbell; Dumbbell Front Raise; Plate Front Raise|Plate;
  Cable Front Raise; Rear Delt Fly|Dumbbell; Reverse Pec Deck|Machine; Cable Rear Delt Fly; Band Pull-Apart; Face Pull|Cable; Band Face Pull;
  Y-T-W Raise|Dumbbell; Barbell Upright Row; Cable Upright Row; Dumbbell External Rotation; Cable External Rotation; Band External Rotation;
  Cable Internal Rotation; Cuban Press|Dumbbell; Overhead Plate Raise|Plate""",
 ("push", "Triceps"): """Close-Grip Push-Up; Bench Dip; Triceps Pushdown|Cable; Rope Triceps Pushdown|Cable; Single-Arm Cable Pushdown; Overhead Cable Triceps Extension;
  Skull Crusher|EZ Bar; Dumbbell Skull Crusher; Overhead Dumbbell Triceps Extension; Single-Arm Overhead Dumbbell Extension; Dumbbell Triceps Kickback;
  Cable Triceps Kickback; JM Press|Barbell; Tate Press|Dumbbell; Band Triceps Pushdown; Machine Triceps Extension; Machine Dip""",
 ("pull", "Back"): """Pull-Up; Chin-Up; Neutral-Grip Pull-Up; Wide-Grip Pull-Up; Weighted Pull-Up; Weighted Chin-Up; Band-Assisted Pull-Up; Assisted Pull-Up Machine|Machine;
  Negative Pull-Up; Scapular Pull-Up; Commando Pull-Up; Lat Pulldown|Cable; Close-Grip Lat Pulldown|Cable; Neutral-Grip Lat Pulldown|Cable;
  Single-Arm Lat Pulldown|Cable; Straight-Arm Pulldown|Cable; Kneeling Single-Arm Pulldown|Cable; Band Lat Pulldown; Barbell Bent-Over Row; Pendlay Row;
  Yates Row|Barbell; Seal Row|Barbell; T-Bar Row|Landmine; Meadows Row|Landmine; Landmine Row; Dumbbell Row; Single-Arm Dumbbell Row;
  Chest-Supported Dumbbell Row; Incline Dumbbell Row; Kroc Row|Dumbbell; Renegade Row|Dumbbell; Kettlebell Row; Single-Arm Kettlebell Row;
  Gorilla Row|Kettlebell; Seated Cable Row; Single-Arm Seated Cable Row; Wide-Grip Seated Cable Row; Half-Kneeling Single-Arm Cable Row; Standing Cable Row;
  Machine Row; Chest-Supported Machine Row; Hammer Strength High Row|Machine; Inverted Row; Ring Row|Rings; TRX Row|Suspension; Band Row;
  Barbell Shrug; Dumbbell Shrug; Trap Bar Shrug; Cable Shrug; Rack Pull; Back Extension; 45-Degree Back Extension; Reverse Hyperextension|Machine;
  Superman Hold; Prone Y Raise|Bodyweight; Dumbbell Pullover; Cable Pullover""",
 ("pull", "Biceps & Grip"): """Barbell Curl; EZ-Bar Curl; Dumbbell Curl; Alternating Dumbbell Curl; Hammer Curl; Cross-Body Hammer Curl; Incline Dumbbell Curl;
  Preacher Curl|EZ Bar; Dumbbell Preacher Curl; Machine Preacher Curl; Concentration Curl|Dumbbell; Spider Curl|Dumbbell; Zottman Curl|Dumbbell;
  Cable Curl; Single-Arm Cable Curl; Bayesian Cable Curl; Rope Hammer Curl|Cable; Reverse Barbell Curl; Drag Curl|Barbell; Band Curl; Kettlebell Curl;
  Wrist Curl|Dumbbell; Reverse Wrist Curl|Dumbbell; Wrist Roller|Other; Plate Pinch|Plate; Dead Hang|Bodyweight; Towel Pull-Up; Fat Grip Hold|Other""",
 ("legs", "Squat"): """Barbell Back Squat; High-Bar Back Squat; Low-Bar Back Squat; Paused Back Squat; Box Squat|Barbell; Pin Squat|Barbell; Front Squat|Barbell;
  Zercher Squat|Barbell; Safety Bar Squat|Specialty Bar; Overhead Squat|Barbell; Anderson Squat|Barbell; Goblet Squat|Dumbbell; Kettlebell Goblet Squat;
  Double Kettlebell Front Squat; Dumbbell Squat; Landmine Squat; Heels-Elevated Goblet Squat|Dumbbell; Smith Machine Squat; Hack Squat|Machine;
  Pendulum Squat|Machine; Belt Squat|Machine; Leg Press|Machine; Single-Leg Leg Press|Machine; Sissy Squat|Bodyweight; Bodyweight Squat; Jump Squat|Bodyweight;
  Wall Sit; Pistol Squat|Bodyweight; Box Pistol Squat|Bodyweight; Skater Squat|Bodyweight; Shrimp Squat|Bodyweight; Cossack Squat|Bodyweight;
  Goblet Cossack Squat|Dumbbell; Lateral Squat|Bodyweight; Sumo Squat|Dumbbell; Leg Extension|Machine; Single-Leg Leg Extension|Machine; Spanish Squat|Band""",
 ("legs", "Hinge"): """Conventional Deadlift|Barbell; Sumo Deadlift|Barbell; Trap Bar Deadlift; High-Handle Trap Bar Deadlift|Trap Bar; Deficit Deadlift|Barbell;
  Paused Deadlift|Barbell; Snatch-Grip Deadlift|Barbell; Romanian Deadlift|Barbell; Dumbbell Romanian Deadlift; Kettlebell Romanian Deadlift;
  Single-Leg Romanian Deadlift|Dumbbell; Kickstand Romanian Deadlift|Dumbbell; Landmine Romanian Deadlift; Landmine Single-Leg Romanian Deadlift;
  Cable Romanian Deadlift; Stiff-Leg Deadlift|Barbell; Good Morning|Barbell; Seated Good Morning|Barbell; Kettlebell Swing; Single-Arm Kettlebell Swing;
  American Kettlebell Swing; Kettlebell Deadlift; Suitcase Deadlift|Dumbbell; Cable Pull-Through; Band Pull-Through; Lying Leg Curl|Machine;
  Seated Leg Curl|Machine; Single-Leg Lying Leg Curl|Machine; Nordic Hamstring Curl|Bodyweight; Glute-Ham Raise|Machine; Swiss Ball Hamstring Curl|Swiss Ball;
  Slider Hamstring Curl|Sliders; Single-Leg Swiss Ball Hamstring Curl|Swiss Ball""",
 ("legs", "Lunge"): """Forward Lunge|Bodyweight; Reverse Lunge|Bodyweight; Dumbbell Reverse Lunge; Barbell Reverse Lunge; Deficit Reverse Lunge|Dumbbell;
  Dumbbell Walking Lunge; Barbell Walking Lunge; Front-Foot-Elevated Split Squat|Dumbbell; Bulgarian Split Squat|Dumbbell; Barbell Bulgarian Split Squat;
  Smith Machine Split Squat; Split Squat|Bodyweight; Dumbbell Split Squat; Landmine Reverse Lunge; Goblet Reverse Lunge|Kettlebell; Curtsy Lunge|Bodyweight;
  Lateral Lunge|Bodyweight; Dumbbell Lateral Lunge; Goblet Lateral Lunge|Kettlebell; Slider Lateral Lunge|Sliders; Slider Reverse Lunge|Sliders;
  Crossover Step-Up|Dumbbell; Step-Up|Bodyweight; Dumbbell Step-Up; Barbell Step-Up; Lateral Step-Up|Dumbbell; Step-Down|Bodyweight; Jumping Lunge|Bodyweight;
  Overhead Walking Lunge|Dumbbell; Rotational Lunge|Med Ball""",
 ("legs", "Glutes"): """Barbell Hip Thrust; Single-Leg Hip Thrust|Bodyweight; Dumbbell Hip Thrust; Machine Hip Thrust; Glute Bridge|Bodyweight; Barbell Glute Bridge;
  Single-Leg Glute Bridge|Bodyweight; Frog Pump|Bodyweight; Cable Kickback; Cable Hip Abduction; Hip Abduction Machine|Machine; Hip Adduction Machine|Machine;
  Banded Lateral Walk|Band; Monster Walk|Band; Clamshell|Band; Fire Hydrant|Bodyweight; Side-Lying Hip Abduction|Bodyweight; Copenhagen Plank|Bodyweight;
  Copenhagen Adduction|Bodyweight; 45-Degree Hip Extension|Machine; Reverse Nordic|Bodyweight""",
 ("legs", "Calves & Shins"): """Standing Calf Raise|Machine; Seated Calf Raise|Machine; Single-Leg Calf Raise|Dumbbell; Smith Machine Calf Raise; Leg Press Calf Raise|Machine;
  Donkey Calf Raise|Machine; Bent-Knee Calf Raise|Bodyweight; Tibialis Raise|Bodyweight; Banded Tibialis Raise|Band; Pogo Jump|Bodyweight""",
 ("core", "Anti-Extension"): """Front Plank; Weighted Plank|Plate; RKC Plank|Bodyweight; Long-Lever Plank|Bodyweight; Plank Shoulder Tap|Bodyweight; Body Saw|Sliders;
  Ab Wheel Rollout|Ab Wheel; Kneeling Ab Wheel Rollout|Ab Wheel; Barbell Rollout; Swiss Ball Rollout|Swiss Ball; Stir the Pot|Swiss Ball; Dead Bug|Bodyweight;
  Weighted Dead Bug|Dumbbell; Band Dead Bug|Band; Hollow Body Hold|Bodyweight; Hollow Rock|Bodyweight; Bear Crawl Hold|Bodyweight; TRX Fallout|Suspension""",
 ("core", "Anti-Rotation"): """Pallof Press|Cable; Band Pallof Press; Half-Kneeling Pallof Press|Cable; Tall-Kneeling Pallof Press|Cable; Split-Stance Pallof Press|Cable;
  Pallof Press with Overhead Reach|Cable; Pallof Hold|Cable; Side Plank|Bodyweight; Side Plank with Hip Dip|Bodyweight; Side Plank Row|Cable;
  Renegade Row Hold|Dumbbell; Bird Dog|Bodyweight; Suitcase Hold|Dumbbell; Single-Arm Plank|Bodyweight""",
 ("core", "Rotation"): """Cable Woodchop; High-to-Low Cable Woodchop; Low-to-High Cable Woodchop; Half-Kneeling Cable Chop; Half-Kneeling Cable Lift;
  Landmine Rotation; Landmine 180|Landmine; Landmine Rainbow|Landmine; Russian Twist|Med Ball; Band Rotation|Band; Cable Rotation;
  Med Ball Rotational Throw; Med Ball Scoop Toss; Med Ball Side Toss; Windshield Wiper|Bodyweight; Seated Cable Rotation; Rotational Med Ball Slam""",
 ("core", "Flexion & Lateral"): """Crunch|Bodyweight; Cable Crunch; Decline Crunch|Bodyweight; Machine Crunch; Sit-Up|Bodyweight; Weighted Sit-Up|Plate; V-Up|Bodyweight;
  Toe Touch|Bodyweight; Reverse Crunch|Bodyweight; Hanging Leg Raise|Bodyweight; Hanging Knee Raise|Bodyweight; Toes-to-Bar|Bodyweight;
  Captain's Chair Leg Raise|Machine; Lying Leg Raise|Bodyweight; Dragon Flag|Bodyweight; L-Sit|Bodyweight; Bicycle Crunch|Bodyweight; Mountain Climber|Bodyweight;
  Dumbbell Side Bend; Cable Side Bend; Hanging Oblique Knee Raise|Bodyweight; Swiss Ball Pike|Swiss Ball; Swiss Ball Knee Tuck|Swiss Ball; TRX Pike|Suspension""",
 ("power", "Olympic Lifts"): """Power Clean|Barbell; Hang Power Clean|Barbell; Hang Clean|Barbell; Clean|Barbell; Clean Pull|Barbell; High Pull|Barbell;
  Muscle Clean|Barbell; Power Snatch|Barbell; Hang Power Snatch|Barbell; Hang Snatch|Barbell; Snatch|Barbell; Snatch Pull|Barbell; Snatch Balance|Barbell;
  Clean and Jerk|Barbell; Split Jerk|Barbell; Push Jerk|Barbell; Clean and Press|Barbell; Dumbbell Snatch; Dumbbell Hang Clean; Dumbbell Clean and Press;
  Kettlebell Clean; Kettlebell Snatch; Kettlebell Clean and Jerk; Landmine Clean|Landmine; Single-Arm Landmine Clean and Press|Landmine; Trap Bar Jump""",
 ("power", "Plyometrics & Throws"): """Box Jump|Box; Seated Box Jump|Box; Depth Jump|Box; Depth Drop|Box; Broad Jump|Bodyweight; Single-Leg Broad Jump|Bodyweight;
  Vertical Jump|Bodyweight; Tuck Jump|Bodyweight; Squat Jump|Bodyweight; Split Squat Jump|Bodyweight; Single-Leg Box Jump|Box; Hurdle Hop|Hurdles;
  Lateral Hurdle Hop|Hurdles; Lateral Box Jump|Box; Bounding|Bodyweight; Lateral Bound|Bodyweight; Skater Bound|Bodyweight; Single-Leg Hop|Bodyweight;
  Ankle Hop|Bodyweight; Plyo Push-Up|Bodyweight; Clap Push-Up|Bodyweight; Med Ball Chest Pass; Med Ball Overhead Throw; Med Ball Slam;
  Med Ball Scoop Throw; Med Ball Shot Put; Med Ball Backward Overhead Throw""",
 ("carry", "Carries"): """Farmer's Carry|Dumbbell; Trap Bar Carry; Kettlebell Farmer's Carry; Suitcase Carry|Dumbbell; Overhead Carry|Dumbbell; Single-Arm Overhead Carry|Kettlebell;
  Front Rack Carry|Kettlebell; Waiter's Carry|Kettlebell; Mixed Carry|Kettlebell; Goblet Carry|Kettlebell; Zercher Carry|Barbell; Sandbag Bear-Hug Carry|Sandbag;
  Sandbag Shoulder Carry|Sandbag; Yoke Carry|Strongman; Bottoms-Up Kettlebell Carry|Kettlebell; Strongman Farmer's Walk|Strongman""",
 ("carry", "Strongman & Sled"): """Sled Push|Sled; Sled Pull|Sled; Backward Sled Drag|Sled; Lateral Sled Drag|Sled; Sled Rope Pull|Sled; Prowler Push|Sled; Tire Flip|Strongman;
  Atlas Stone Lift|Strongman; Sandbag Clean|Sandbag; Sandbag Over Shoulder|Sandbag; Log Clean and Press|Strongman; Axle Deadlift|Strongman;
  Keg Carry|Strongman; Sledgehammer Strike|Strongman; Battle Rope Waves|Battle Ropes; Battle Rope Slams|Battle Ropes; Scrum Machine Drive|Machine""",
 ("cardio", "Machines"): """Treadmill Run|Machine; Incline Treadmill Walk|Machine; Rowing Machine|Machine; Assault Bike|Machine; Stationary Bike|Machine; Spin Bike|Machine;
  SkiErg|Machine; Elliptical|Machine; Stair Climber|Machine; VersaClimber|Machine; Curved Treadmill Sprint|Machine""",
 ("cardio", "Running & Conditioning"): """Outdoor Run|Bodyweight; Sprint|Bodyweight; Hill Sprint|Bodyweight; Shuttle Run|Bodyweight; 300-Yard Shuttle|Bodyweight;
  Tempo Run|Bodyweight; Bronco Test|Bodyweight; Yo-Yo Intermittent Run|Bodyweight; Burpee|Bodyweight; Burpee Broad Jump|Bodyweight; Jumping Jack|Bodyweight;
  Jump Rope|Jump Rope; Double-Under|Jump Rope; High Knees|Bodyweight; Butt Kicks|Bodyweight; Bear Crawl|Bodyweight; Crab Walk|Bodyweight;
  Swimming|Other; Cycling|Other; Thruster|Barbell; Dumbbell Thruster; Wall Ball|Med Ball; Man Maker|Dumbbell; Devil Press|Dumbbell;
  Kettlebell Complex|Kettlebell; Barbell Complex""",
 ("agility", "Change of Direction"): """Lateral Shuffle|Bodyweight; Banded Lateral Shuffle|Band; Defensive Slide|Bodyweight; Carioca|Bodyweight; Crossover Run|Bodyweight;
  5-10-5 Pro Agility Drill|Cones; T-Drill|Cones; Box Drill|Cones; L-Drill|Cones; Illinois Agility Drill|Cones; Cone Weave|Cones; Zig-Zag Cone Drill|Cones;
  Mirror Drill|Bodyweight; Reactive Ball Drop|Other; Split Step|Bodyweight; Drop Step|Bodyweight; Lateral Crossover Step|Bodyweight; Lateral A-Skip|Bodyweight;
  Lateral Skater Hop|Bodyweight; Lateral Med Ball Toss and Shuffle|Med Ball; Band-Resisted Lateral Bound|Band; Lateral Lunge to Sprint|Bodyweight;
  Ladder Icky Shuffle|Agility Ladder; Ladder Lateral In-Out|Agility Ladder; Ladder Two Feet In|Agility Ladder; Ladder Single-Leg Hop|Agility Ladder;
  Ladder Crossover|Agility Ladder; Dot Drill|Bodyweight; Four-Square Hop|Bodyweight; A-Skip|Bodyweight; B-Skip|Bodyweight; Wall Drill|Bodyweight;
  Falling Start|Bodyweight; Sled-Resisted Sprint|Sled; Partner-Resisted Sprint|Band; Backpedal|Bodyweight; Backpedal to Sprint|Bodyweight""",
 ("mobility", "Mobility"): """World's Greatest Stretch|Bodyweight; 90/90 Hip Switch|Bodyweight; Hip CARs|Bodyweight; Shoulder CARs|Bodyweight; Cat-Cow|Bodyweight;
  Thoracic Spine Rotation|Bodyweight; Open Book|Bodyweight; Thread the Needle|Bodyweight; Quadruped Rock Back|Bodyweight; Deep Squat Hold|Bodyweight;
  Goblet Squat Pry|Kettlebell; Ankle Dorsiflexion Mobilization|Bodyweight; Knee-to-Wall Ankle Mobilization|Bodyweight; Leg Swing|Bodyweight;
  Lateral Leg Swing|Bodyweight; Inchworm|Bodyweight; Spiderman Lunge with Rotation|Bodyweight; Walking Knee Hug|Bodyweight; Walking Quad Pull|Bodyweight;
  Frankenstein Walk|Bodyweight; Hip Airplane|Bodyweight; Wall Slide|Bodyweight; Scapular Wall Slide|Bodyweight; Band Dislocate|Band; PVC Pass-Through|PVC;
  Prone Swimmer|Bodyweight; Wrist Mobility Circles|Bodyweight; Neck CARs|Bodyweight; Foam Roll Thoracic Spine|Foam Roller; Foam Roll Quads|Foam Roller;
  Foam Roll IT Band|Foam Roller; Foam Roll Lats|Foam Roller; Lacrosse Ball Glute Release|Other; Lacrosse Ball Pec Release|Other""",
 ("stretch", "Stretching"): """Couch Stretch|Bodyweight; Half-Kneeling Hip Flexor Stretch|Bodyweight; Pigeon Stretch|Bodyweight; Figure-4 Stretch|Bodyweight;
  Butterfly Stretch|Bodyweight; Frog Stretch|Bodyweight; Seated Hamstring Stretch|Bodyweight; Standing Hamstring Stretch|Bodyweight; Lying Hamstring Stretch|Band;
  Standing Quad Stretch|Bodyweight; Side-Lying Quad Stretch|Bodyweight; Adductor Rock Back|Bodyweight; Standing Calf Stretch|Bodyweight;
  Soleus Wall Stretch|Bodyweight; Child's Pose|Bodyweight; Cobra Stretch|Bodyweight; Lat Stretch|Bodyweight; Doorway Pec Stretch|Bodyweight;
  Cross-Body Shoulder Stretch|Bodyweight; Sleeper Stretch|Bodyweight; Overhead Triceps Stretch|Bodyweight; Upper Trap Stretch|Bodyweight;
  Levator Scapulae Stretch|Bodyweight; Wrist Flexor Stretch|Bodyweight; Wrist Extensor Stretch|Bodyweight; Supine Spinal Twist|Bodyweight;
  Seated Glute Stretch|Bodyweight; Standing Side Bend Stretch|Bodyweight; Downward Dog|Bodyweight; Happy Baby|Bodyweight; Banded Hip Distraction|Band""",
}
EQUIP_PREFIX = [("Barbell", "Barbell"), ("EZ-Bar", "EZ Bar"), ("Dumbbell", "Dumbbell"), ("Kettlebell", "Kettlebell"), ("Double Kettlebell", "Kettlebell"),
  ("Cable", "Cable"), ("Machine", "Machine"), ("Band", "Band"), ("Banded", "Band"), ("Landmine", "Landmine"), ("Smith Machine", "Smith Machine"),
  ("Trap Bar", "Trap Bar"), ("Med Ball", "Med Ball"), ("Sandbag", "Sandbag"), ("Ring", "Rings"), ("TRX", "Suspension"), ("Swiss Ball", "Swiss Ball"),
  ("Slider", "Sliders"), ("Sled", "Sled")]
OVERRIDE = {n: "Barbell" for n in ["Floor Press", "Spoto Press", "Pin Press", "Board Press", "Push Press", "Behind-the-Neck Press", "Z Press",
  "Pendlay Row", "Rack Pull", "High-Bar Back Squat", "Low-Bar Back Squat", "Paused Back Squat"]}
OVERRIDE.update({"Pec Deck Fly": "Machine", "Arnold Press": "Dumbbell", "Hammer Curl": "Dumbbell", "Cross-Body Hammer Curl": "Dumbbell",
  "Back Extension": "Machine", "45-Degree Back Extension": "Machine", "Weighted Push-Up": "Plate", "Weighted Dip": "Plate",
  "Weighted Pull-Up": "Plate", "Weighted Chin-Up": "Plate"})
def infer(name):
    if name in OVERRIDE: return OVERRIDE[name]
    for pre, eq in sorted(EQUIP_PREFIX, key=lambda x: -len(x[0])):
        if name.startswith(pre + " ") or name.startswith(pre + "-"): return eq
    for word, eq in [("Cable", "Cable"), ("Dumbbell", "Dumbbell"), ("Kettlebell", "Kettlebell"), ("Barbell", "Barbell"), ("Landmine", "Landmine"),
                     ("Machine", "Machine"), ("Band", "Band"), ("Med Ball", "Med Ball"), ("Trap Bar", "Trap Bar")]:
        if word in name: return eq
    if re.search(r"Push-Up|Pull-Up|Chin-Up|Dip|Plank|Row$", name): return "Bodyweight"
    return None

items, seen, errs = [], {}, []
labels = dict(CATS)
for (cat, sub), blob in DATA.items():
    for raw in [x.strip() for x in blob.replace("\n", " ").split(";") if x.strip()]:
        name, _, eq = raw.partition("|")
        name = re.sub(r"\s+", " ", name).strip(); eq = eq.strip() or infer(name) or "Bodyweight"
        key = re.sub(r"[^a-z0-9]", "", name.lower())
        if key in seen: errs.append(f"duplicate: {name} ({cat}/{sub}) vs {seen[key]}"); continue
        seen[key] = f"{cat}/{sub}"
        items.append([name, cat, sub, eq])
if errs: print("\n".join(errs)); sys.exit(1)
counts = {k: sum(1 for i in items if i[1] == k) for k, _ in CATS}
out = {"version": 1, "categories": [{"key": k, "label": l, "count": counts[k]} for k, l in CATS],
       "fields": ["name", "cat", "sub", "equip"], "items": items}
dst = os.path.join(os.path.dirname(__file__), "..", "exercises-library.js")
with open(dst, "w") as f:
    f.write("/* SlimTucci built-in exercise library. Generated by tools/build_library.py, do not hand-edit. */\n")
    f.write("window.SLIMTUCCI_LIBRARY = " + json.dumps(out, separators=(",", ":"), ensure_ascii=False) + ";\n")
print("total", len(items)); print(json.dumps(counts))
eqc = {}
for i in items: eqc[i[3]] = eqc.get(i[3], 0) + 1
print(json.dumps(dict(sorted(eqc.items(), key=lambda x: -x[1]))))
