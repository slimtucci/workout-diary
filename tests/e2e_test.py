"""End-to-end phone test (390x844) for the SlimTucci Workout Diary.
Local: python3 -m http.server 8765  then  python3 tests/e2e_test.py
Live:  BASE=https://slimtucci.github.io/workout-diary/ SHOTS=/path python3 tests/e2e_test.py"""
import json, sys, os, datetime
from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE", "http://localhost:8765/")
SHOTS = os.environ.get("SHOTS", "")
PREFIX = os.environ.get("SHOT_PREFIX", "")
results = []
def check(name, cond, detail=""):
    results.append((name, bool(cond), detail)); print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
def shot(page, name):
    if SHOTS: page.screenshot(path=os.path.join(SHOTS, PREFIX + name))

TODAY = datetime.date.today()
SUN = TODAY - datetime.timedelta(days=(TODAY.weekday() + 1) % 7)   # Sunday of this week
SAT = SUN + datetime.timedelta(days=6)
iso = lambda d: d.isoformat()

def picker_search(page, q):
    page.fill("#pickQ", q); page.wait_for_timeout(50)
    return page.locator("#pickList .pick-row .pr-name").all_inner_texts()
def picker_pick(page, name):
    page.locator("#pickList .pick-row", has=page.locator(".pr-name", has_text=name)).first.click()
def picker_done(page):
    page.locator('.sheet-head [data-x="close"]').click(); page.wait_for_selector(".sheet-bg", state="detached")
def fill_set(card, si, w, r):
    card.locator(f'input[data-si="{si}"][data-k="weight"]').fill(str(w)); card.locator(f'input[data-si="{si}"][data-k="reps"]').fill(str(r))
def tap_day(page, d):
    page.click(f'.day[data-date="{iso(d)}"]'); page.wait_for_selector(f'#dayPanel[data-day="{iso(d)}"]')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, accept_downloads=True, color_scheme="light")
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())
    errors = []; page.on("pageerror", lambda e: (errors.append(str(e)), print("PAGEERROR", e.stack)))
    page.goto(BASE); page.wait_for_selector("#dayPanel")

    # ---- empty start ----
    st = page.evaluate("() => window.SlimTucci.state")
    check("starts with no workouts, templates or plans", len(st["sessions"]) == 0 and len(st["templates"]) == 0 and len(st.get("plans", [])) == 0)
    check("SlimTucci branding only", page.locator("#title").inner_text() == "SlimTucci" and "tuccigang" not in page.content().lower())
    sel = page.locator(".day.sel").get_attribute("data-date")
    check("today's day selected by default", sel == iso(TODAY), sel)
    empty = page.locator(".day-empty").inner_text()
    check("friendly empty state for the day", empty.startswith(f"No workouts on {TODAY.strftime('%a')}") and "tap + to log one" in empty, empty)
    check("welcome card shown on empty start", page.locator(".welcome").count() == 1)
    lib = page.evaluate("() => ({ n: window.SlimTucci.libSize, cats: window.SLIMTUCCI_LIBRARY.categories.map(c => [c.label, c.count]) })")
    check("library loaded with 300+ movements", lib["n"] >= 300, f"{lib['n']} · " + ", ".join(f"{l} {c}" for l, c in lib["cats"]))
    check("week strip starts Sunday", page.locator(".day").first.get_attribute("data-date") == iso(SUN))
    wk = page.evaluate("() => { const S = window.SlimTucci; return [S.weekStart('2026-10-04'), S.weekStart('2026-10-10'), S.weekStart('2026-10-11'), S.weekStart('2026-10-03')] }")
    check("Sun–Sat week math (Sun 4 & Sat 10 together, Sun 11 new week)", wk == ["2026-10-04", "2026-10-04", "2026-10-11", "2026-09-27"], str(wk))
    overflow = page.evaluate("() => document.scrollingElement.scrollWidth")
    check("no horizontal overflow at 390px", overflow <= 390, str(overflow))

    # ---- tap days ----
    tap_day(page, SUN)
    check("tapping Sunday selects it", page.locator(".day.sel").get_attribute("data-date") == iso(SUN) and page.locator(".day.sel").get_attribute("aria-pressed") == "true")
    check("day panel shows Sunday", page.locator(".day-title").inner_text().startswith("Sunday"), page.locator(".day-title").inner_text())
    check("Sunday empty state", "No workouts on Sun" in page.locator(".day-empty").inner_text())
    check("today still outlined", page.locator(f'.day.today[data-date="{iso(TODAY)}"]').count() == 1)

    # ---- Exercises tab: library browse/search/add + custom ----
    page.click('.tabbar a[data-tab="exercises"]'); page.click('.seg-btn[data-seg="lib"]')
    page.fill("#exQ", "bulgrian split")   # typo on purpose
    names = page.locator("#exResults .pr-name").all_inner_texts()
    check("library fuzzy search ('bulgrian split') finds Bulgarian Split Squat", any("Bulgarian Split Squat" == n for n in names), ", ".join(names[:4]))
    page.fill("#exQ", ""); page.click('#app .chip[data-chip="agility"]')
    ag = page.locator("#exResults .pr-name").all_inner_texts()
    check("category chip filters (Agility)", len(ag) >= 20 and "Lateral Shuffle" in ag, f"{len(ag)} shown")
    page.click('#app .chip[data-chip="all"]'); page.fill("#exQ", "copenhagen plank")
    page.locator("#exResults .pick-row", has=page.locator(".pr-name", has_text="Copenhagen Plank")).first.click()
    check("tapping a library movement adds it to My exercises", any(e["name"] == "Copenhagen Plank" for e in page.evaluate("() => window.SlimTucci.state.exercises")))
    page.click('.seg-btn[data-seg="mine"]'); page.fill("#exQ", "Pickleball Ready Hop")
    page.click('#exResults [data-x="custom"]')
    mine = page.locator("#exResults .pr-name").all_inner_texts()
    check("custom exercise added from Exercises tab", "Pickleball Ready Hop" in mine)

    # ---- template built with the picker ----
    page.goto(BASE + "#/templates"); page.wait_for_selector("#newTpl")
    check("templates empty state", page.locator(".empty-title").inner_text() == "No templates yet")
    page.fill("#newTpl", "Sunday Lateral Test"); page.click('[data-action="tpl-create"]'); page.wait_for_selector("#tName")
    page.click('[data-action="ti-add"]')
    r = picker_search(page, "landmine rot")
    check("picker: 'landmine rot' → Landmine Rotation first", r and r[0] == "Landmine Rotation", ", ".join(r[:3]))
    picker_pick(page, "Landmine Rotation")
    picker_search(page, "lateral bound"); picker_pick(page, "Lateral Bound")
    picker_done(page)
    names = page.locator(".ex-card .ex-name").all_inner_texts()
    check("template picker added 2 exercises (multi-add)", names == ["Landmine Rotation", "Lateral Bound"], str(names))
    check("library pick auto-added to My exercises with category", any(e["name"] == "Lateral Bound" and e["cat"] == "Power & Plyo" for e in page.evaluate("() => window.SlimTucci.state.exercises")))

    # ---- log a workout on Sunday via the day panel ----
    page.goto(BASE + "#/"); page.wait_for_selector("#dayPanel"); tap_day(page, SUN)
    page.locator('#dayPanel [data-action="day-add"]').last.click()
    page.click('.sheet [data-x="blank"]'); page.wait_for_selector("#sDate")
    check("blank workout is dated to the selected day", page.input_value("#sDate") == iso(SUN))
    check("log empty state + sticky Add/Finish bar", page.locator(".empty-title").inner_text() == "No exercises yet" and page.locator(".actionbar").is_visible())
    page.fill("#sName", "Sunday Strength")
    page.locator('.actionbar [data-action="add-ex"]').click()
    check("picker opens with My exercises first, then Library", page.locator("#pickList .sec-title").first.inner_text().lower().startswith("my exercises") and page.locator("#pickList .sec-title").nth(1).inner_text().lower().startswith("library"))
    picker_search(page, "back squat"); picker_pick(page, "Barbell Back Squat")
    r = picker_search(page, "zercher")
    check("picker library search 'zercher'", "Zercher Squat" in r, ", ".join(r))
    picker_pick(page, "Zercher Squat")
    r = picker_search(page, "Tucci Scrum Drive Hold")
    check("picker offers Add custom when no match", page.locator('#pickList [data-x="custom"]').count() == 1)
    page.click('#pickList [data-x="custom"]')
    check("Done button counts adds", page.locator('.sheet-head [data-x="close"]').inner_text() == "Done (3)")
    picker_done(page)
    names = page.locator(".ex-card .ex-name").all_inner_texts()
    check("3 exercises added to workout", names == ["Barbell Back Squat", "Zercher Squat", "Tucci Scrum Drive Hold"], str(names))
    ex = page.evaluate("() => window.SlimTucci.state.exercises.map(e => [e.name, e.cat])")
    check("Zercher Squat auto-added to My exercises (Legs)", ["Zercher Squat", "Legs"] in ex)
    check("custom exercise saved to My exercises", any(n == "Tucci Scrum Drive Hold" for n, c in ex))
    sq = page.locator(".ex-card").nth(0)
    fill_set(sq, 0, 225, 5); sq.locator('[data-action="set-add"]').click(); sq = page.locator(".ex-card").nth(0)
    check("add set copies previous values", sq.locator('input[data-si="1"][data-k="weight"]').input_value() == "225")
    sq.locator('[data-action="set-add"]').click(); sq = page.locator(".ex-card").nth(0)
    sq.locator('[data-action="set-remove"][data-si="2"]').click(); sq = page.locator(".ex-card").nth(0)
    check("remove set works", sq.locator("tbody tr").count() == 2)
    sq.locator('[data-action="set-done"][data-si="0"]').click()
    check("done tick turns set green", sq.locator("tbody tr").first.get_attribute("class") == "done")
    fill_set(page.locator(".ex-card").nth(1), 0, 135, 8)
    page.locator("details.notes summary").first.click(); page.fill('textarea[data-bind="session"]', "Legs felt springy")
    page.locator(".ex-card").nth(0).locator("details.notes summary").click(); page.locator(".ex-card").nth(0).locator('textarea[data-bind="exnote"]').fill("Belt on top set")
    page.locator('.actionbar [data-action="finish"]').click(); page.wait_for_selector("#dayPanel")
    check("Finish returns to the workout's day", page.locator("#dayPanel").get_attribute("data-day") == iso(SUN))
    check("Sunday shows logged dot + session", page.locator(f'.day.has-log[data-date="{iso(SUN)}"]').count() == 1 and page.locator("#dayPanel .list-item .title").first.inner_text() == "Sunday Strength")

    # ---- plan a template on Saturday, then start it ----
    tap_day(page, SAT)
    page.click('#dayPanel [data-action="day-plan"]'); page.click('.sheet [data-x="plan"]')
    page.wait_for_selector("#dayPanel .planned")
    check("planned template shows on Saturday with a plan dot", page.locator("#dayPanel .planned .title").inner_text() == "Sunday Lateral Test" and page.locator(f'.day.has-plan[data-date="{iso(SAT)}"]').count() == 1)
    shot(page, "01-day-selected.png")
    page.click('#dayPanel [data-action="plan-start"]'); page.wait_for_selector("#sDate")
    check("starting the plan creates a workout dated Saturday from the template", page.input_value("#sDate") == iso(SAT) and page.locator(".ex-card .ex-name").all_inner_texts() == ["Landmine Rotation", "Lateral Bound"])
    fill_set(page.locator(".ex-card").nth(0), 0, 45, 8)
    page.locator('.actionbar [data-action="finish"]').click(); page.wait_for_selector("#dayPanel")
    check("plan replaced by logged session", page.locator("#dayPanel .planned").count() == 0 and page.locator(f'.day.has-log[data-date="{iso(SAT)}"]').count() == 1)

    # ---- last-time hint ----
    tap_day(page, TODAY) if SUN <= TODAY <= SAT else None
    page.goto(BASE + "#/"); page.wait_for_selector("#dayPanel")
    page.locator('#dayPanel [data-action="day-add"]').last.click(); page.click('.sheet [data-x="blank"]'); page.wait_for_selector("#sDate")
    page.fill("#sDate", iso(SAT + datetime.timedelta(days=1))); page.locator("#sDate").dispatch_event("change")
    page.locator('.actionbar [data-action="add-ex"]').click(); picker_search(page, "barbell back squat"); picker_pick(page, "Barbell Back Squat"); picker_done(page)
    last = page.locator(".ex-card .last").first.inner_text()
    check("'last time' hint shows previous sets", "225 × 5" in last, last)
    shot(page, "03-log-workout.png")
    page.click('[data-action="del-session"]'); page.wait_for_selector("#dayPanel")

    # ---- week arrows keep a selected day ----
    before = datetime.date.fromisoformat(page.locator(".day.sel").get_attribute("data-date"))
    page.click('[data-action="week-next"]')
    check("next week moves selection +7 days", page.locator(".day.sel").get_attribute("data-date") == iso(before + datetime.timedelta(days=7)) and page.locator(".day").first.get_attribute("data-date") == iso(SUN + datetime.timedelta(days=7)))
    page.click('[data-action="week-prev"]'); page.click('[data-action="week-prev"]')
    check("prev week arrow", page.locator(".day").first.get_attribute("data-date") == iso(SUN - datetime.timedelta(days=7)))
    page.click('[data-action="go-today"]')
    check("Today button returns to today", page.locator(".day.sel").get_attribute("data-date") == iso(TODAY))

    # ---- persistence across reload ----
    page.reload(); page.wait_for_selector("#dayPanel")
    st = page.evaluate("() => window.SlimTucci.state")
    s1 = [s for s in st["sessions"] if s["name"] == "Sunday Strength"]
    check("2 sessions persisted after reload", len(st["sessions"]) == 2, str(len(st["sessions"])))
    check("weights, done tick and notes persisted", s1 and [(x["weight"], x["reps"], x["done"]) for x in s1[0]["exercises"][0]["sets"]] == [("225", "5", True), ("225", "5", False)] and s1[0]["notes"] == "Legs felt springy" and s1[0]["exercises"][0]["notes"] == "Belt on top set",
          str(s1 and s1[0]["exercises"][0]["sets"]))
    tap_day(page, SUN)
    check("tapping Sunday after reload shows its workout", page.locator("#dayPanel .list-item .title").first.inner_text() == "Sunday Strength")

    # ---- history search ----
    page.click('.tabbar a[data-tab="history"]'); page.fill("#histQ", "zercher")
    check("history search by exercise", page.locator("#histList .list-item .title").all_inner_texts() == ["Sunday Strength"])
    page.fill("#histQ", "nothingmatches")
    check("history no-match state with Clear button", page.locator('[data-action="hist-clear"]').count() == 1)
    page.click('[data-action="hist-clear"]')
    check("history grouped by Sun–Sat week", page.locator(".week-group").first.get_attribute("data-week") == iso(SUN))

    # ---- picker screenshot ----
    page.goto(BASE + "#/"); page.wait_for_selector("#dayPanel"); page.locator('#dayPanel [data-action="day-add"]').last.click(); page.click('.sheet [data-x="blank"]'); page.wait_for_selector("#sDate")
    page.locator('.actionbar [data-action="add-ex"]').click(); picker_search(page, "lateral"); page.click('.sheet .chip[data-chip="agility"]'); page.wait_for_timeout(100)
    page.evaluate("document.activeElement.blur()"); page.wait_for_timeout(300)
    shot(page, "02-picker-search.png")
    picker_done(page); page.click('[data-action="del-session"]'); page.wait_for_selector("#dayPanel")


    # ---- macro calculator ----
    check("Macros tab in the bottom bar; Templates under More", page.locator('.tabbar a[data-tab="macros"]').count() == 1 and page.locator('.tabbar a[data-tab="templates"]').count() == 0)
    page.goto(BASE + "#/settings"); page.wait_for_selector('a.list-item[href="#/templates"]')
    check("More page links to Templates", page.locator('a.list-item[href="#/templates"]').count() == 1)
    page.goto(BASE + "#/"); page.wait_for_selector("#dayPanel")
    check("Today shows a 'set your macro targets' prompt before setup", page.locator("a.macro-mini.empty-mini").count() == 1)
    page.click('.tabbar a[data-tab="macros"]'); page.wait_for_selector("#mWeight")
    check("macro page empty state before inputs", "Enter your weight, height and age" in page.locator("#macroResults").inner_text())
    page.fill("#mWeight", "205"); page.fill("#mFt", "6"); page.fill("#mIn", "4"); page.fill("#mAge", "30")
    page.click('[data-action="macro-set"][data-k="activity"][data-v="moderate"]'); page.click('[data-action="macro-set"][data-k="goal"][data-v="maintain"]')
    got = [page.locator(sel).inner_text().replace("\n", "").replace(" kcal", "").replace(",", "").replace("g", "") for sel in ("#mCalories", "#mProtein", "#mCarbs", "#mFat")]
    meta = page.locator("#mMeta").inner_text()
    check("205 lb, 6'4\", 30 M, moderate, maintain → 3100 kcal · P185 · C435 · F70", got == ["3100", "185", "435", "70"], str(got))
    check("BMR 1991 / TDEE 3087 (Mifflin-St Jeor)", meta == "BMR 1,991 · TDEE 3,087 kcal · Mifflin-St Jeor", meta)
    check("% split shown (24/56/20)", [t.strip() for t in page.locator(".mc-pct").all_inner_texts()] == ["24%", "56%", "20%"])
    r = page.evaluate("() => window.SlimTucci.computeTargets({weightKg: 205/2.20462, heightCm: 76*2.54, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain'})")
    check("computeTargets() hook matches UI", (r["calories"], r["protein"], r["carbs"], r["fat"], r["bmr"], r["tdee"]) == (3100, 185, 435, 70, 1991, 3087))
    r2 = page.evaluate("() => window.SlimTucci.computeTargets({weightKg: 205/2.20462, heightCm: 76*2.54, age: 30, sex: 'male', activity: 'moderate', goal: 'maintain'}, 400)")
    check("extraBurnKcal hook adds calories to carbs", r2["calories"] == 3500 and r2["protein"] == 185 and r2["carbs"] > r["carbs"], f"{r2['calories']} kcal, C {r2['carbs']}")
    page.locator("#toast").wait_for(state="hidden"); page.evaluate("document.activeElement.blur(); window.scrollTo(0,0)"); page.wait_for_timeout(200)
    shot(page, "05-macros.png")
    page.click(".how summary")
    how = page.locator(".how").inner_text()
    check("'How this was calculated' expander", "Mifflin-St Jeor BMR" in how and "× 1.55" in how and "Carbs fill the rest" in how)
    check("disclaimer shown", "Estimates only" in page.locator(".disclaimer").first.inner_text() and "coach" in page.locator(".disclaimer").first.inner_text())
    page.click('[data-action="macro-set"][data-k="goal"][data-v="cut"]')
    check("cut (standard −15%) → 2600 kcal, protein up to 205 g", page.locator("#mCalories").inner_text().startswith("2,600") and page.locator("#mProtein").inner_text().startswith("205"))
    page.click('[data-action="macro-set"][data-k="wUnit"][data-v="kg"]')
    check("kg toggle converts the value (93 kg) without changing targets", page.input_value("#mWeight") == "93" and page.locator("#mCalories").inner_text().startswith("2,600"), page.input_value("#mWeight"))
    page.click('[data-action="macro-set"][data-k="hUnit"][data-v="cm"]')
    check("cm toggle converts height (193 cm)", page.input_value("#mCm") == "193", page.input_value("#mCm"))
    page.fill("#mBf", "15")
    check("body-fat % switches BMR to Katch-McArdle", "Katch-McArdle" in page.locator("#mMeta").inner_text(), page.locator("#mMeta").inner_text())
    page.fill("#mBf", ""); page.click('[data-action="macro-set"][data-k="wUnit"][data-v="lb"]'); page.click('[data-action="macro-set"][data-k="hUnit"][data-v="ftin"]')
    page.click('[data-action="macro-set"][data-k="goal"][data-v="maintain"]')
    page.reload(); page.wait_for_selector("#mWeight")
    check("macro inputs persist after reload", (page.input_value("#mWeight"), page.input_value("#mFt"), page.input_value("#mIn"), page.input_value("#mAge")) == ("205", "6", "4", "30") and page.locator(".choice.on .ch-t").inner_text() == "Moderately active")
    check("latest result persists after reload", page.locator("#mCalories").inner_text().startswith("3,100"))
    page.goto(BASE + "#/"); page.wait_for_selector("#dayPanel")
    mini = page.locator("a.macro-mini").inner_text().replace("\n", " ")
    check("Today shows compact targets", "3,100" in mini and "185g" in mini and "435g" in mini and "70g" in mini, mini)

    # ---- export ----
    page.goto(BASE + "#/settings")
    with page.expect_download() as dl: page.click('[data-action="export"]')
    data = json.load(open(dl.value.path()))
    check("export JSON includes sessions + plans + macros", data["app"] == "slimtucci-diary" and len(data["data"]["sessions"]) == 2 and "plans" in data["data"] and data["data"]["macros"]["result"]["calories"] == 3100)

    # ---- service worker / offline incl. library ----
    page.goto(BASE); page.evaluate("async () => { await navigator.serviceWorker.ready; }")
    page.reload(); page.wait_for_function("navigator.serviceWorker.controller !== null", timeout=15000)
    cache = page.evaluate("async () => { const ks = await caches.keys(); const c = await caches.open(ks[0]); return [ks, (await c.keys()).map(r => r.url.split('/').pop())]; }")
    check("SW cache st-diary-v4 holds library + macro files", "st-diary-v4" in cache[0] and "exercises-library.js" in cache[1] and "macros-calc.js" in cache[1], str(cache[0]))
    ctx.set_offline(True); page.reload(); page.wait_for_selector("#dayPanel")
    check("offline: app + library load", page.evaluate("() => window.SlimTucci.libSize") >= 300)
    ctx.set_offline(False)

    # ---- dark mode render ----
    dctx = b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=3, is_mobile=True, has_touch=True, color_scheme="dark")
    dp = dctx.new_page(); dp.on("pageerror", lambda e: errors.append(str(e)))
    dp.goto(BASE); dp.wait_for_selector("#dayPanel")
    bg = dp.evaluate("() => getComputedStyle(document.body).backgroundColor")
    check("auto dark mode via prefers-color-scheme", bg == "rgb(14, 20, 22)", bg)
    shot(dp, "04-dark-mode.png")
    dp.goto(BASE + "#/macros"); dp.wait_for_selector("#mWeight")
    dp.fill("#mWeight", "205"); dp.fill("#mFt", "6"); dp.fill("#mIn", "4"); dp.fill("#mAge", "30")
    hero = dp.evaluate("() => { const e = document.querySelector('.macro-hero'); const cs = getComputedStyle(e); return [cs.backgroundColor, cs.color]; }")
    check("macro page in dark mode (teal hero, dark ink)", hero == ["rgb(45, 212, 191)", "rgb(4, 47, 43)"] and dp.locator("#mCalories").inner_text().startswith("3,100"), str(hero))
    dp.evaluate("document.activeElement.blur(); window.scrollTo(0,0)"); dp.wait_for_timeout(200)
    shot(dp, "06-macros-dark.png")
    check("no JS errors", not errors, "; ".join(errors))
    b.close()

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} checks passed")
sys.exit(1 if fails else 0)
