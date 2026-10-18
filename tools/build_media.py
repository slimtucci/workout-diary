"""Builds exercise-media.js + img/ex/*.webp for the Exercises grid.

Photos + muscles come from the public-domain free-exercise-db (github.com/yuhonas/free-exercise-db, Unlicense).
Each of our library movements is matched by normalized name, then by the hand-checked ALIAS table below.
No loose fuzzy matching is accepted: a movement without a confident match gets a muscle diagram only,
with muscles inferred from our category / sub-group / name via RULES.

Run:  git clone --depth 1 https://github.com/yuhonas/free-exercise-db /tmp/fedb
      python3 tools/build_media.py /tmp/fedb"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FEDB = sys.argv[1] if len(sys.argv) > 1 else '/workspace/free-exercise-db'
W, Q = 400, 62

# Our muscle regions (also the ids in the SVG body map in app.js)
REGIONS = ['chest', 'fdelt', 'sdelt', 'rdelt', 'biceps', 'triceps', 'forearm', 'abs', 'oblique', 'lats', 'upback', 'traps',
           'lowback', 'glutes', 'hipflex', 'adduct', 'abduct', 'quads', 'hams', 'calves', 'shins']

# Hand-checked: our name -> free-exercise-db name. Only same movement (a pause/tempo/stance variant that looks the same in a photo is OK).
ALIAS = {
  'Barbell Bench Press': 'Barbell Bench Press - Medium Grip', 'Paused Barbell Bench Press': 'Barbell Bench Press - Medium Grip',
  'Incline Barbell Bench Press': 'Barbell Incline Bench Press - Medium Grip', 'Smith Machine Incline Press': 'Smith Machine Incline Bench Press',
  'Incline Dumbbell Bench Press': 'Incline Dumbbell Press', 'Single-Arm Dumbbell Bench Press': 'One Arm Dumbbell Bench Press',
  'Alternating Dumbbell Bench Press': 'Dumbbell Bench Press', 'Neutral-Grip Dumbbell Bench Press': 'Dumbbell Bench Press with Neutral Grip',
  'Kettlebell Floor Press': 'One-Arm Kettlebell Floor Press', 'Single-Arm Kettlebell Floor Press': 'One-Arm Kettlebell Floor Press',
  'Cable Fly': 'Cable Crossover', 'High-to-Low Cable Fly': 'Cable Crossover', 'Low-to-High Cable Fly': 'Low Cable Crossover',
  'Single-Arm Cable Fly': 'Single-Arm Cable Crossover', 'Machine Chest Press': 'Leverage Chest Press', 'Incline Machine Chest Press': 'Leverage Incline Chest Press',
  'Pec Deck Fly': 'Butterfly', 'Hammer Strength Chest Press': 'Leverage Chest Press', 'Wide Push-Up': 'Push-Up Wide',
  'Diamond Push-Up': 'Push-Ups - Close Triceps Position', 'Close-Grip Push-Up': 'Push-Ups - Close Triceps Position', 'Chest Dip': 'Dips - Chest Version',
  'Barbell Overhead Press': 'Standing Military Press', 'Behind-the-Neck Press': 'Standing Barbell Press Behind Neck',
  'Seated Barbell Shoulder Press': 'Seated Barbell Military Press', 'Seated Dumbbell Shoulder Press': 'Seated Dumbbell Press',
  'Single-Arm Dumbbell Shoulder Press': 'Dumbbell One-Arm Shoulder Press', 'Arnold Press': 'Arnold Dumbbell Press',
  'Kettlebell Overhead Press': 'Two-Arm Kettlebell Military Press', 'Machine Shoulder Press': 'Machine Shoulder (Military) Press',
  'Smith Machine Shoulder Press': 'Smith Machine Overhead Shoulder Press', 'Dumbbell Lateral Raise': 'Side Lateral Raise',
  'Cable Lateral Raise': 'Standing Low-Pulley Deltoid Raise', 'Dumbbell Front Raise': 'Front Dumbbell Raise', 'Plate Front Raise': 'Front Plate Raise',
  'Cable Front Raise': 'Front Cable Raise', 'Rear Delt Fly': 'Reverse Flyes', 'Reverse Pec Deck': 'Reverse Machine Flyes',
  'Barbell Upright Row': 'Upright Barbell Row', 'Cable Upright Row': 'Upright Cable Row', 'Dumbbell External Rotation': 'External Rotation',
  'Cable External Rotation': 'External Rotation with Cable', 'Band External Rotation': 'External Rotation with Band',
  'Rope Triceps Pushdown': 'Triceps Pushdown - Rope Attachment', 'Overhead Cable Triceps Extension': 'Cable Rope Overhead Triceps Extension',
  'Skull Crusher': 'EZ-Bar Skullcrusher', 'Dumbbell Skull Crusher': 'Lying Dumbbell Tricep Extension',
  'Overhead Dumbbell Triceps Extension': 'Standing Dumbbell Triceps Extension', 'Single-Arm Overhead Dumbbell Extension': 'Standing One-Arm Dumbbell Triceps Extension',
  'Dumbbell Triceps Kickback': 'Tricep Dumbbell Kickback', 'Machine Dip': 'Dip Machine',
  'Neutral-Grip Pull-Up': 'V-Bar Pullup', 'Wide-Grip Pull-Up': 'Pullups', 'Negative Pull-Up': 'Pullups', 'Lat Pulldown': 'Wide-Grip Lat Pulldown',
  'Close-Grip Lat Pulldown': 'Close-Grip Front Lat Pulldown', 'Neutral-Grip Lat Pulldown': 'V-Bar Pulldown', 'Single-Arm Lat Pulldown': 'One Arm Lat Pulldown',
  'Kneeling Single-Arm Pulldown': 'Kneeling Single-Arm High Pulley Row', 'Barbell Bent-Over Row': 'Bent Over Barbell Row', 'Pendlay Row': 'Bent Over Barbell Row',
  'Yates Row': 'Reverse Grip Bent-Over Rows', 'Seal Row': 'Lying Cambered Barbell Row', 'T-Bar Row': 'T-Bar Row with Handle',
  'Meadows Row': 'Bent Over One-Arm Long Bar Row', 'Landmine Row': 'Bent Over Two-Arm Long Bar Row', 'Dumbbell Row': 'Bent Over Two-Dumbbell Row',
  'Single-Arm Dumbbell Row': 'One-Arm Dumbbell Row', 'Kroc Row': 'One-Arm Dumbbell Row', 'Chest-Supported Dumbbell Row': 'Dumbbell Incline Row',
  'Incline Dumbbell Row': 'Dumbbell Incline Row', 'Renegade Row': 'Alternating Renegade Row', 'Kettlebell Row': 'Two-Arm Kettlebell Row',
  'Single-Arm Kettlebell Row': 'One-Arm Kettlebell Row', 'Gorilla Row': 'Alternating Kettlebell Row', 'Single-Arm Seated Cable Row': 'Seated One-arm Cable Pulley Rows',
  'Machine Row': 'Leverage Iso Row', 'Chest-Supported Machine Row': 'Leverage Iso Row', 'Hammer Strength High Row': 'Leverage High Row',
  'Ring Row': 'Inverted Row with Straps', 'TRX Row': 'Suspended Row', 'Rack Pull': 'Rack Pulls', 'Back Extension': 'Hyperextensions (Back Extensions)',
  '45-Degree Back Extension': 'Hyperextensions (Back Extensions)', 'Superman Hold': 'Superman', 'Dumbbell Pullover': 'Bent-Arm Dumbbell Pullover',
  'Dumbbell Curl': 'Dumbbell Bicep Curl', 'Alternating Dumbbell Curl': 'Dumbbell Alternate Bicep Curl', 'Dumbbell Preacher Curl': 'Two-Arm Dumbbell Preacher Curl',
  'Cable Curl': 'Standing Biceps Cable Curl', 'Single-Arm Cable Curl': 'Standing One-Arm Cable Curl', 'Rope Hammer Curl': 'Cable Hammer Curls - Rope Attachment',
  'Wrist Curl': 'Seated Dumbbell Palms-Up Wrist Curl', 'Reverse Wrist Curl': 'Seated Dumbbell Palms-Down Wrist Curl',
  'Barbell Back Squat': 'Barbell Squat', 'High-Bar Back Squat': 'Barbell Squat', 'Low-Bar Back Squat': 'Barbell Squat', 'Paused Back Squat': 'Barbell Squat',
  'Front Squat': 'Front Barbell Squat', 'Kettlebell Goblet Squat': 'Goblet Squat', 'Double Kettlebell Front Squat': 'Front Squats With Two Kettlebells',
  'Sissy Squat': 'Weighted Sissy Squat', 'Jump Squat': 'Freehand Jump Squat', 'Sumo Squat': 'Plie Dumbbell Squat',
  'Conventional Deadlift': 'Barbell Deadlift', 'Paused Deadlift': 'Barbell Deadlift', 'High-Handle Trap Bar Deadlift': 'Trap Bar Deadlift',
  'Snatch-Grip Deadlift': 'Snatch Deadlift', 'Dumbbell Romanian Deadlift': 'Stiff-Legged Dumbbell Deadlift', 'Single-Leg Romanian Deadlift': 'Kettlebell One-Legged Deadlift',
  'Stiff-Leg Deadlift': 'Stiff-Legged Barbell Deadlift', 'Seated Good Morning': 'Seated Good Mornings', 'Single-Arm Kettlebell Swing': 'One-Arm Kettlebell Swings',
  'Cable Pull-Through': 'Pull Through', 'Band Pull-Through': 'Band Good Morning (Pull Through)', 'Nordic Hamstring Curl': 'Natural Glute Ham Raise',
  'Swiss Ball Hamstring Curl': 'Ball Leg Curl', 'Dumbbell Reverse Lunge': 'Dumbbell Rear Lunge', 'Dumbbell Walking Lunge': 'Dumbbell Lunges',
  'Bulgarian Split Squat': 'Split Squat with Dumbbells', 'Smith Machine Split Squat': 'Smith Single-Leg Split Squat', 'Glute Bridge': 'Butt Lift (Bridge)',
  'Cable Kickback': 'One-Legged Cable Kickback', 'Hip Abduction Machine': 'Thigh Abductor', 'Hip Adduction Machine': 'Thigh Adductor',
  'Leg Press Calf Raise': 'Calf Press On The Leg Press Machine',
  'Front Plank': 'Plank', 'RKC Plank': 'Plank', 'Ab Wheel Rollout': 'Ab Roller', 'Kneeling Ab Wheel Rollout': 'Ab Roller', 'Barbell Rollout': 'Barbell Ab Rollout',
  'TRX Fallout': 'Suspended Fallout', 'Band Pallof Press': 'Pallof Press', 'Side Plank': 'Side Bridge', 'Cable Woodchop': 'Standing Cable Wood Chop',
  'High-to-Low Cable Woodchop': 'Standing Cable Wood Chop', 'Low-to-High Cable Woodchop': 'Standing Cable Lift', 'Landmine Rotation': "Landmine 180's",
  'Landmine 180': "Landmine 180's", 'Med Ball Scoop Toss': 'Medicine Ball Scoop Throw', 'Machine Crunch': 'Ab Crunch Machine', 'Toe Touch': 'Toe Touchers',
  "Captain's Chair Leg Raise": 'Knee/Hip Raise On Parallel Bars', 'Lying Leg Raise': 'Flat Bench Lying Leg Raise', 'Bicycle Crunch': 'Air Bike',
  'Mountain Climber': 'Mountain Climbers', 'Swiss Ball Knee Tuck': 'Exercise Ball Pull-In',
  'Hang Power Clean': 'Hang Clean', 'Hang Power Snatch': 'Hang Snatch', 'Push Jerk': 'Power Jerk', 'Dumbbell Hang Clean': 'Dumbbell Clean',
  'Kettlebell Clean': 'One-Arm Kettlebell Clean', 'Kettlebell Snatch': 'One-Arm Kettlebell Snatch', 'Kettlebell Clean and Jerk': 'One-Arm Kettlebell Clean and Jerk',
  'Box Jump': 'Front Box Jump', 'Depth Jump': 'Linear Depth Jump', 'Broad Jump': 'Standing Long Jump', 'Tuck Jump': 'Knee Tuck Jump', 'Squat Jump': 'Freehand Jump Squat',
  'Split Squat Jump': 'Split Jump', 'Hurdle Hop': 'Hurdle Hops', 'Lateral Hurdle Hop': 'Lateral Cone Hops', 'Skater Bound': 'Lateral Bound', 'Clap Push-Up': 'Plyo Push-up',
  'Med Ball Chest Pass': 'Medicine Ball Chest Pass', 'Med Ball Overhead Throw': 'Standing Two-Arm Overhead Throw', 'Med Ball Slam': 'Overhead Slam',
  'Med Ball Scoop Throw': 'Medicine Ball Scoop Throw', 'Med Ball Backward Overhead Throw': 'Backward Medicine Ball Throw',
  "Farmer's Carry": "Farmer's Walk", "Strongman Farmer's Walk": "Farmer's Walk", 'Yoke Carry': 'Yoke Walk', 'Sled Pull': 'Sled Drag - Harness',
  'Backward Sled Drag': 'Backward Drag', 'Prowler Push': 'Sled Push', 'Atlas Stone Lift': 'Atlas Stones', 'Log Clean and Press': 'Log Lift',
  'Sledgehammer Strike': 'Sledgehammer Swings', 'Battle Rope Waves': 'Battling Ropes',
  'Treadmill Run': 'Running, Treadmill', 'Incline Treadmill Walk': 'Walking, Treadmill', 'Rowing Machine': 'Rowing, Stationary',
  'Stationary Bike': 'Bicycling, Stationary', 'Elliptical': 'Elliptical Trainer', 'Stair Climber': 'Stairmaster', 'Jump Rope': 'Rope Jumping',
  'Cat-Cow': 'Cat Stretch', 'Wrist Mobility Circles': 'Wrist Circles', 'Foam Roll Quads': 'Quadriceps-SMR',
  'Foam Roll IT Band': 'Iliotibial Tract-SMR', 'Foam Roll Lats': 'Latissimus Dorsi-SMR', 'Half-Kneeling Hip Flexor Stretch': 'Kneeling Hip Flexor',
  'Seated Hamstring Stretch': 'Seated Floor Hamstring Stretch', 'Lying Hamstring Stretch': 'Leg-Up Hamstring Stretch', 'Side-Lying Quad Stretch': 'On Your Side Quad Stretch',
  'Standing Calf Stretch': 'Calf Stretch Hands Against Wall', 'Soleus Wall Stretch': 'Standing Soleus And Achilles Stretch', 'Cross-Body Shoulder Stretch': 'Shoulder Stretch',
  'Overhead Triceps Stretch': 'Triceps Stretch', 'Upper Trap Stretch': 'Side Neck Stretch', 'Seated Glute Stretch': 'Seated Glute',
}
# exact-name matches that are NOT the same movement (block them)
BLOCK = set()
# free-exercise-db photos whose 2nd frame shows the movement better (saved as frame 0 so the card uses it)
HERO_SECOND = {'Plank'}

REP = [(r'pull ?ups?', 'pull up'), (r'chin ?ups?', 'chin up'), (r'push ?ups?', 'push up'), (r'sit ?ups?', 'sit up'), (r'step ?ups?', 'step up'),
       (r'dumbbells', 'dumbbell'), (r'pulldowns?', 'pulldown'), (r'\bcurls\b', 'curl'), (r'\braises\b', 'raise'), (r'\bextensions\b', 'extension'),
       (r'\brows\b', 'row'), (r'\bflyes?\b|\bflys\b', 'fly'), (r'\bpresses\b', 'press'), (r'\bsquats\b', 'squat'), (r'\blunges\b', 'lunge'),
       (r'\bshrugs\b', 'shrug'), (r'\bcrunches\b', 'crunch'), (r'\bdips\b', 'dip'), (r'\bswings\b', 'swing'), (r'\bdeadlifts\b', 'deadlift')]
def norm(n):
    n = re.sub(r'[^a-z0-9]+', ' ', n.lower().replace('’', '').replace("'", ''))
    for a, b in REP: n = re.sub(a, b, n)
    return ' '.join(n.split())

PRIO = ['glutes', 'hams', 'quads', 'chest', 'lats', 'upback', 'fdelt', 'sdelt', 'rdelt', 'triceps', 'biceps', 'oblique', 'abs', 'lowback', 'adduct', 'abduct', 'traps', 'hipflex', 'calves', 'forearm', 'shins']
def has(name, *words): return any(re.search(r'\b' + w, name) for w in words)

def map_fedb(f, name, cat):
    """free-exercise-db muscle names -> our regions; 'shoulders' is split into front/side/rear delts by the movement."""
    n = name.lower()
    def sh():
        if has(n, 'lateral raise', 'upright', 'side lateral', 'deltoid raise'): return 'sdelt'
        if has(n, 'rear', 'reverse fl', 'reverse pec', 'face pull', 'pull apart', 'pull-apart', 'external rot', 'y-t-w'): return 'rdelt'
        if cat == 'pull': return 'rdelt'
        return 'fdelt'
    M = {'chest': 'chest', 'biceps': 'biceps', 'triceps': 'triceps', 'forearms': 'forearm', 'lats': 'lats', 'middle back': 'upback', 'traps': 'traps',
         'neck': 'traps', 'lower back': 'lowback', 'glutes': 'glutes', 'quadriceps': 'quads', 'hamstrings': 'hams', 'calves': 'calves',
         'adductors': 'adduct', 'abductors': 'abduct'}
    def conv(lst):
        out = []
        for m in lst:
            r = sh() if m == 'shoulders' else ('oblique' if has(n, 'twist', 'rotat', 'oblique', 'side bend', 'chop', 'wood', 'lift', 'pallof', 'side plank', 'side bridge', '180', 'landmine rot', 'scoop', 'sledgehammer', 'bicycle', 'carioca') and m == 'abdominals' else ('abs' if m == 'abdominals' else M.get(m)))
            if r and r not in out: out.append(r)
        return out
    p, s = conv(f['primaryMuscles']), conv(f['secondaryMuscles'])
    s.sort(key=lambda r: PRIO.index(r) if r in PRIO else 99)  # most meaningful secondary first (free-exercise-db lists them alphabetically)
    if has(n, 'woodchop', 'chop', 'cable lift', 'landmine', 'side plank', 'pallof') and 'oblique' in p and 'abs' not in p + s: s.append('abs')
    return p, [x for x in s if x not in p]

# Rules for movements without a photo match: first match wins. (pattern, primary, secondary). Checked against name (lowercase).
RULES = [
  # stretches / mobility first (they'd otherwise hit "press", "row" etc.)
  (r'foam roll thoracic|thoracic|open book|thread the needle', 'upback oblique', 'lats'),
  (r'couch stretch|quad stretch|quad pull', 'quads hipflex', ''), (r'hip flexor|kneeling hip', 'hipflex', 'quads'),
  (r'pigeon|figure-4|glute stretch|glute release|90/90|hip car|hip airplane', 'glutes', 'abduct'),
  (r'adductor|frog stretch|butterfly stretch|happy baby|hip distraction', 'adduct', 'glutes'),
  (r'hamstring stretch|leg swing$|walking knee hug|frankenstein', 'hams', 'glutes'),
  (r'lateral leg swing', 'adduct abduct', 'glutes'),
  (r'calf stretch|soleus|ankle|knee-to-wall', 'calves', 'shins'),
  (r'pec stretch|doorway|pec release', 'chest', 'fdelt'), (r'lat stretch|foam roll lats', 'lats', 'upback'),
  (r'sleeper|cross-body shoulder|shoulder car|band dislocate|pvc pass', 'rdelt sdelt', 'fdelt'),
  (r'triceps stretch', 'triceps', 'lats'), (r'trap stretch|levator|neck car', 'traps', ''), (r'wrist', 'forearm', ''),
  (r'cat-cow|cobra|child|side bend stretch|supine spinal', 'lowback abs', 'oblique'),
  (r'downward dog|inchworm', 'hams calves', 'fdelt'), (r"world's greatest|spiderman lunge", 'hipflex hams', 'upback glutes'),
  (r'deep squat hold|goblet squat pry|quadruped rock', 'adduct glutes', 'quads'), (r'wall slide|prone swimmer|scapular wall', 'rdelt upback', 'traps'),
  (r'foam roll it|it band', 'abduct', 'quads'), (r'foam roll quads', 'quads', ''),
  # core
  (r'pallof|suitcase hold|side plank|single-arm plank|stir the pot', 'oblique abs', ''),
  (r'woodchop|cable chop|cable lift|rotation|rotational|landmine 180|rainbow|russian twist|windshield|side toss|scoop', 'oblique', 'abs'),
  (r'side bend|oblique', 'oblique', 'abs'), (r'bird dog', 'lowback glutes', 'abs'),
  (r'leg raise|knee raise|toes-to-bar|l-sit|v-up|dragon flag|knee tuck|pike$|swiss ball pike|hollow', 'abs hipflex', 'oblique'),
  (r'plank|rollout|dead bug|body saw|fallout|bear crawl hold|crunch|sit-up|toe touch|renegade row hold', 'abs', 'oblique'),
  # olympic / power
  (r'snatch|clean|high pull', 'glutes hams quads traps', 'lowback fdelt calves'), (r'jerk', 'fdelt triceps quads', 'glutes'),
  (r'clap push|chest pass|shot put', 'chest triceps', 'fdelt'), (r'slam|overhead throw|backward overhead', 'lats abs', 'fdelt glutes'),
  (r'lateral bound|skater|lateral hurdle|lateral skater|lateral a-skip|band-resisted lateral', 'glutes abduct', 'quads calves adduct'),
  (r'pogo|ankle hop|single-leg hop|hop|bound|skip|jump rope|double-under|dot drill|ladder', 'calves', 'quads glutes'),
  (r'jump', 'quads glutes', 'calves hams'), (r'depth drop', 'quads glutes', 'calves'),
  # carries / strongman
  (r'overhead carry|waiter', 'sdelt fdelt traps', 'abs oblique'), (r'suitcase carry|single-arm', 'oblique forearm', 'traps'),
  (r'front rack carry|goblet carry|zercher carry|bear-hug|keg', 'abs upback', 'biceps quads'), (r'carry|farmer', 'forearm traps', 'abs glutes'),
  (r'lateral sled', 'abduct glutes', 'quads adduct'), (r'rope pull|sled pull', 'lats upback', 'biceps forearm'),
  (r'sled|prowler|scrum', 'quads glutes', 'calves'), (r'battle rope', 'fdelt sdelt', 'abs forearm'),
  (r'sandbag|atlas', 'glutes hams lowback', 'traps biceps'), (r'sledgehammer', 'oblique lats', 'forearm'),
  # cardio / agility
  (r'row(ing)? machine|skierg', 'lats upback', 'quads triceps'), (r'bike|cycling|elliptical', 'quads glutes', 'calves hams'),
  (r'stair|versaclimber', 'glutes quads', 'calves'), (r'swim', 'lats fdelt', 'triceps'), (r'burpee|man maker|devil press', 'chest quads', 'fdelt triceps glutes'),
  (r'thruster|wall ball', 'quads fdelt', 'glutes triceps'), (r'complex', 'glutes quads fdelt', 'traps'),
  (r'jumping jack', 'calves abduct', 'sdelt'), (r'high knees', 'hipflex quads', 'calves'), (r'butt kicks', 'hams', 'calves'),
  (r'bear crawl', 'fdelt abs', 'quads'), (r'crab walk', 'triceps glutes', 'rdelt'),
  (r'shuffle|slide|carioca|crossover|cone|drill|mirror|split step|drop step|reactive', 'abduct adduct glutes', 'quads calves'),
  (r'sprint|run|shuttle|backpedal|falling start|bronco|yo-yo|wall drill|tempo', 'quads hams glutes', 'calves'),
]
SUB_RULES = {  # (cat, sub) default when no name rule matched; plus name rules per sub below
  ('push', 'Chest'): ('chest', 'fdelt triceps'), ('push', 'Shoulders'): ('fdelt', 'sdelt triceps'), ('push', 'Triceps'): ('triceps', 'chest'),
  ('pull', 'Back'): ('lats upback', 'biceps rdelt'), ('pull', 'Biceps & Grip'): ('biceps', 'forearm'),
  ('legs', 'Squat'): ('quads glutes', 'adduct hams'), ('legs', 'Hinge'): ('hams glutes', 'lowback forearm'), ('legs', 'Lunge'): ('quads glutes', 'hams adduct'),
  ('legs', 'Glutes'): ('glutes', 'hams'), ('legs', 'Calves & Shins'): ('calves', ''),
}
SUB_NAME_RULES = [  # applied for strength subs before the sub default
  (('push', 'Shoulders'), r'lateral', 'sdelt', 'traps'), (('push', 'Shoulders'), r'rear|pull-apart|face pull|y-t-w|external|internal|cuban', 'rdelt', 'upback'),
  (('push', 'Shoulders'), r'front raise|plate raise', 'fdelt', 'sdelt'), (('push', 'Shoulders'), r'upright', 'sdelt traps', 'biceps'),
  (('push', 'Shoulders'), r'wall walk', 'fdelt triceps', 'abs'),
  (('push', 'Chest'), r'diamond|close-grip', 'triceps chest', 'fdelt'), (('push', 'Chest'), r'incline', 'chest fdelt', 'triceps'),
  (('push', 'Triceps'), r'push-up|dip', 'triceps', 'chest fdelt'),
  (('pull', 'Back'), r'shrug', 'traps', 'forearm'), (('pull', 'Back'), r'extension|hyper|superman|good morning', 'lowback', 'glutes hams'),
  (('pull', 'Back'), r'prone y', 'traps rdelt', 'upback'), (('pull', 'Back'), r'pullover', 'lats', 'chest triceps'),
  (('pull', 'Back'), r'rack pull', 'lowback traps glutes', 'hams forearm'), (('pull', 'Back'), r'pull-up|pulldown|chin', 'lats', 'biceps upback'),
  (('pull', 'Back'), r'row', 'upback lats', 'biceps rdelt'),
  (('pull', 'Biceps & Grip'), r'wrist|roller|pinch|hang|grip|towel', 'forearm', 'biceps'), (('pull', 'Biceps & Grip'), r'hammer|reverse|zottman', 'biceps forearm', ''),
  (('legs', 'Squat'), r'extension', 'quads', ''), (('legs', 'Squat'), r'cossack|lateral squat|sumo', 'quads adduct', 'glutes'),
  (('legs', 'Squat'), r'sissy|spanish|wall sit', 'quads', ''), (('legs', 'Squat'), r'jump', 'quads glutes', 'calves'),
  (('legs', 'Squat'), r'leg press', 'quads glutes', 'hams'),
  (('legs', 'Hinge'), r'curl|nordic|glute-ham', 'hams', 'calves glutes'), (('legs', 'Hinge'), r'swing|pull-through', 'glutes hams', 'lowback'),
  (('legs', 'Hinge'), r'conventional|deficit|paused deadlift|trap bar|kettlebell deadlift|suitcase', 'glutes hams quads', 'lowback traps forearm'),
  (('legs', 'Hinge'), r'good morning', 'hams lowback', 'glutes'),
  (('legs', 'Lunge'), r'lateral|curtsy|cossack', 'adduct glutes quads', 'abduct'), (('legs', 'Lunge'), r'step-down|step-up', 'quads glutes', 'hams'),
  (('legs', 'Glutes'), r'abduction|clamshell|hydrant|lateral walk|monster|band walk', 'abduct glutes', ''),
  (('legs', 'Glutes'), r'adduct|copenhagen', 'adduct', 'abs oblique'), (('legs', 'Glutes'), r'reverse nordic', 'quads hipflex', ''),
  (('legs', 'Glutes'), r'45-degree hip', 'glutes hams', 'lowback'),
  (('legs', 'Calves & Shins'), r'tibialis', 'shins', ''),
]
def infer(name, cat, sub):
    n = name.lower()
    for key, pat, p, s in SUB_NAME_RULES:
        if key == (cat, sub) and re.search(pat, n): return p.split(), s.split()
    if (cat, sub) in SUB_RULES:
        p, s = SUB_RULES[(cat, sub)]; return p.split(), s.split()
    for pat, p, s in RULES:
        if re.search(pat, n): return p.split(), s.split()
    DEF = {'core': ('abs', 'oblique'), 'power': ('quads glutes', 'calves'), 'carry': ('forearm traps', 'abs'), 'cardio': ('quads glutes', 'calves'),
           'agility': ('quads glutes', 'calves'), 'mobility': ('hipflex', ''), 'stretch': ('hams', '')}
    p, s = DEF[cat]; return p.split(), s.split()

def main():
    from PIL import Image
    s = open(os.path.join(ROOT, 'exercises-library.js')).read(); L = json.loads(s[s.index('{'):s.rindex('}') + 1])
    F = json.load(open(os.path.join(FEDB, 'dist', 'exercises.json'))); BYNAME = {f['name']: f for f in F}; BYNORM = {norm(f['name']): f for f in F}
    for k, v in ALIAS.items(): assert v in BYNAME, f'alias target missing: {v}'
    names = {it[0] for it in L['items']}
    for k in ALIAS: assert k in names, f'alias source not in library: {k}'
    out_dir = os.path.join(ROOT, 'img', 'ex'); os.makedirs(out_dir, exist_ok=True)
    keep, items, report = set(), [], []
    for name, cat, sub, equip, cues in L['items']:
        f = None; how = ''
        if name in ALIAS: f, how = BYNAME[ALIAS[name]], 'alias'
        elif norm(name) in BYNORM and name not in BLOCK: f, how = BYNORM[norm(name)], 'exact'
        if f and len(f.get('images', [])) >= 1:
            p, sec = map_fedb(f, name, cat)
            if not p: p, sec = infer(name, cat, sub)
            slug = f['id']
            imgs = f['images'][:2]
            if f['id'] in HERO_SECOND: imgs = imgs[::-1]
            for i, rel in enumerate(imgs):
                dst = os.path.join(out_dir, f'{slug}-{i}.webp'); keep.add(os.path.basename(dst))
                if not os.path.exists(dst):
                    im = Image.open(os.path.join(FEDB, 'exercises', rel)).convert('RGB')
                    im = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
                    for q in (Q, 54, 46):  # keep each file under ~24 KB
                        im.save(dst, 'WEBP', quality=q, method=6)
                        if os.path.getsize(dst) <= 24 * 1024: break
            items.append([slug, ' '.join(p), ' '.join(sec), min(2, len(f['images']))]); report.append((name, how, f['name']))
        else:
            p, sec = infer(name, cat, sub); items.append([0, ' '.join(p), ' '.join(sec), 0]); report.append((name, 'diagram', ''))
        for r in (items[-1][1] + ' ' + items[-1][2]).split(): assert r in REGIONS, (name, r)
    for fn in os.listdir(out_dir):
        if fn not in keep: os.remove(os.path.join(out_dir, fn))
    n_photo = sum(1 for x in items if x[0])
    js = ('/* SlimTucci exercise media: photo slug (img/ex/<slug>-0|1.webp, from the public-domain free-exercise-db) + primary/secondary muscle regions per library item, '
          'index-aligned with exercises-library.js. Generated by tools/build_media.py, do not hand-edit. */\n'
          'window.SLIMTUCCI_MEDIA = ' + json.dumps({'version': 1, 'source': 'free-exercise-db (github.com/yuhonas/free-exercise-db), public domain (Unlicense)',
                                                    'fields': ['img', 'primary', 'secondary', 'frames'], 'items': items}, separators=(',', ':')) + ';\n')
    open(os.path.join(ROOT, 'exercise-media.js'), 'w').write(js)
    with open(os.path.join(ROOT, 'tools', 'media_matches.txt'), 'w') as fh:
        fh.write(f'# {n_photo}/{len(items)} library movements matched to a free-exercise-db photo; {len(items) - n_photo} diagram-only\n')
        for r in report: fh.write(' | '.join(r) + '\n')
    tot = sum(os.path.getsize(os.path.join(out_dir, x)) for x in os.listdir(out_dir))
    print(f'{n_photo}/{len(items)} with photos ({sum(1 for r in report if r[1]=="exact")} exact, {sum(1 for r in report if r[1]=="alias")} alias), '
          f'{len(items) - n_photo} diagram-only; {len(os.listdir(out_dir))} images, {tot/1024:.0f} KB, max {max(os.path.getsize(os.path.join(out_dir, x)) for x in os.listdir(out_dir))/1024:.1f} KB; media js {len(js)/1024:.1f} KB')

if __name__ == '__main__':
    main()
