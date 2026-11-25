import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { SHORTCUT_NAME, awaitingHealth, clearAwaitingHealth, importFromClipboard, runHealthShortcut } from '../platform/health'
import { dayTotals, medSlots, setIntake, useDay, type DayData } from '../lib/day'
import { addDays, daysBetween, formatLong, greeting, minutesToHM, relativeDay, timeStr, todayStr } from '../lib/dates'
import {
  ACTIVITY_KINDS,
  DRINK_KINDS,
  INTAKE_LABEL,
  MEAL_SIZES,
  MEAL_TYPES,
  MOOD_FACES,
  SEVERITY,
  SOCIAL,
  SUBSTANCE_KINDS,
  icon,
  label,
} from '../lib/labels'
import { useSettings, type Settings } from '../lib/settings'
import { navigate, openSheet, toast, type SheetKind } from '../lib/store'
import { isIOSWeb, isStandalone } from '../platform/native'

export function DayView({ date }: { date: string }) {
  const d = useDay(date)
  const s = useSettings()
  const isToday = date === todayStr()
  if (!d) return <div className="screen" />
  return (
    <div className="screen">
      <DayHeader date={date} name={s.name} />
      {isToday && <Banners settings={s} />}
      <QuickButtons date={date} settings={s} />
      {isToday && isIOSWeb && s.iosShortcut && <AppleHealthCard />}
      <Summary d={d} s={s} />
      <Timeline d={d} />
      <p className="footnote">Jeder Eintrag zählt. Lücken sind völlig okay. 💛</p>
    </div>
  )
}

function DayHeader({ date, name }: { date: string; name: string }) {
  const isToday = date === todayStr()
  const go = (n: number) => {
    const t = addDays(date, n)
    navigate(t === todayStr() ? '/heute' : `/tag?d=${t}`)
  }
  return (
    <header className="day-header">
      <button className="icon-btn" onClick={() => go(-1)} aria-label="Vortag">
        ‹
      </button>
      <div className="day-title">
        {isToday ? (
          <>
            <div className="eyebrow">{formatLong(date)}</div>
            <h1>
              {greeting()}
              {name ? `, ${name}` : ''}
            </h1>
          </>
        ) : (
          <>
            <div className="eyebrow">{relativeDay(date) === formatLong(date) ? 'Rückblick' : relativeDay(date)}</div>
            <h1>{formatLong(date)}</h1>
          </>
        )}
      </div>
      <button className="icon-btn" onClick={() => go(1)} aria-label="Nächster Tag" disabled={isToday} style={{ visibility: isToday ? 'hidden' : 'visible' }}>
        ›
      </button>
    </header>
  )
}

function Banners({ settings }: { settings: Settings }) {
  const lastPhq = useLiveQuery(() => db.phq9.orderBy('ts').last(), [])
  const firstUse = useLiveQuery(async () => {
    const m = await db.checkins.orderBy('ts').first()
    return m?.date
  }, [])
  const showInstall = isIOSWeb && !isStandalone
  const phqDue =
    (lastPhq && daysBetween(lastPhq.date, todayStr()) >= settings.phqIntervalDays) ||
    (!lastPhq && firstUse && daysBetween(firstUse, todayStr()) >= 1)
  return (
    <>
      {!settings.onboarded && (
        <div className="card banner welcome">
          <h3>Willkommen 🌱</h3>
          <p>
            Hier hältst du fest, wie dein Tag war: Bewegung, Essen, Trinken, Stimmung, Schlaf und Medikamente. Alles bleibt nur
            auf diesem Gerät. Es gibt kein Richtig oder Falsch – ein Tipp am Tag ist schon viel.
          </p>
          {showInstall && (
            <p className="small">
              <b>Tipp:</b> Tippe in Safari auf <b>Teilen</b> → <b>Zum Home-Bildschirm</b>, dann startet Depri wie eine App.
            </p>
          )}
          <button className="btn small" onClick={() => db.settings.put({ key: 'onboarded', value: true })}>
            Verstanden
          </button>
        </div>
      )}
      {settings.onboarded && showInstall && (
        <div className="card banner subtle">
          <p className="small">
            Damit deine Daten sicher bleiben: In Safari <b>Teilen → Zum Home-Bildschirm</b> und Depri von dort öffnen.
          </p>
        </div>
      )}
      {phqDue && (
        <button className="card banner phq" onClick={() => navigate('/phq9')}>
          <div>
            <h3>Fragebogen für die letzten 2 Wochen</h3>
            <p className="small">9 kurze Fragen, ca. 2 Minuten. Hilft dir und deinem Arzt, den Verlauf zu sehen.</p>
          </div>
          <span className="chev">›</span>
        </button>
      )}
    </>
  )
}

function AppleHealthCard() {
  const [waiting, setWaiting] = useState(awaitingHealth())
  useEffect(() => {
    const onVis = () => document.visibilityState === 'visible' && setWaiting(awaitingHealth())
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])
  const paste = async () => {
    try {
      const r = await importFromClipboard()
      if (!r) {
        toast('In der Zwischenablage sind keine Health-Daten. Lief der Kurzbefehl?')
        return
      }
      clearAwaitingHealth()
      setWaiting(false)
      toast(
        `Übernommen: ${[r.steps != null ? `${r.steps.toLocaleString('de-DE')} Schritte` : '', r.sleepMin ? `${minutesToHM(r.sleepMin)} Schlaf` : '']
          .filter(Boolean)
          .join(', ')} ✓`,
      )
    } catch {
      toast('Zugriff auf die Zwischenablage nicht erlaubt.')
    }
  }
  return (
    <div className="card health-card">
      {waiting ? (
        <>
          <p className="small">Fertig im Kurzbefehl? Dann hier einfügen (Safari fragt kurz nach – auf „Einfügen“ tippen).</p>
          <div className="row-inline">
            <button className="btn primary" onClick={paste}>
              Health-Werte einfügen
            </button>
            <button className="btn ghost small" onClick={runHealthShortcut}>
              Nochmal holen
            </button>
          </div>
        </>
      ) : (
        <button className="health-btn" onClick={runHealthShortcut}>
          <span>❤️</span>
          <span>
            <b>Schritte & Schlaf aus Apple Health holen</b>
            <span className="small muted block">startet den Kurzbefehl „{SHORTCUT_NAME}“</span>
          </span>
        </button>
      )}
    </div>
  )
}

function QuickButtons({ date, settings }: { date: string; settings: Settings }) {
  const addDrink = async (kind: 'wasser' | 'kaffee') => {
    const ml = kind === 'wasser' ? settings.quickWaterMl : settings.quickCoffeeMl
    const ts = date === todayStr() ? Date.now() : new Date(`${date}T12:00`).getTime()
    const id = await db.drinks.add({ ts, date, kind, ml, caffeine: kind === 'kaffee' })
    toast(kind === 'wasser' ? `+${ml} ml Wasser 💧` : `+${ml} ml Kaffee ☕`, () => db.drinks.delete(id as number))
  }
  const open = (kind: SheetKind) => () => openSheet({ kind, date })
  return (
    <div className="quick">
      <button className="quick-btn water" onClick={() => addDrink('wasser')}>
        <span className="q-icon">💧</span>
        <span>Wasser</span>
      </button>
      <button className="quick-btn coffee" onClick={() => addDrink('kaffee')}>
        <span className="q-icon">☕</span>
        <span>Kaffee</span>
      </button>
      <button className="quick-btn food" onClick={open('meal')}>
        <span className="q-icon">🍽️</span>
        <span>Essen</span>
      </button>
      <button className="quick-btn move" onClick={open('activity')}>
        <span className="q-icon">🚶</span>
        <span>Aktivität</span>
      </button>
      <button className="quick-btn mood" onClick={open('checkin')}>
        <span className="q-icon">💛</span>
        <span>Check-in</span>
      </button>
      <button className="quick-btn other" onClick={open('drink')}>
        <span className="q-icon">🥤</span>
        <span>Getränk</span>
      </button>
    </div>
  )
}

function Progress({ value, goal }: { value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0
  return (
    <div className="progress" aria-hidden="true">
      <div style={{ width: `${pct}%` }} />
    </div>
  )
}

function Summary({ d, s }: { d: DayData; s: Settings }) {
  const t = dayTotals(d)
  const show = (k: string) => s.todaySections[k] !== false
  const slots = medSlots(d)
  return (
    <div className="cards">
      {show('movement') && (
        <div className="card tile move">
          <button className="tile-main" onClick={() => openSheet({ kind: 'steps', date: d.date })}>
            <div className="tile-head">👣 Bewegung</div>
            <div className="tile-value">
              {t.steps != null ? t.steps.toLocaleString('de-DE') : '–'} <span className="unit">Schritte</span>
            </div>
            {t.steps != null && <Progress value={t.steps} goal={s.goalSteps} />}
            <div className="tile-sub">
              {t.activeMin > 0 ? `${minutesToHM(t.activeMin)} aktiv` : 'Antippen zum Eintragen'}
              {d.steps && d.steps.source !== 'manual' ? ' · automatisch' : ''}
            </div>
          </button>
          <button className="tile-add" onClick={() => openSheet({ kind: 'activity', date: d.date })} aria-label="Aktivität hinzufügen">
            +
          </button>
        </div>
      )}
      {show('drinks') && (
        <div className="card tile water">
          <button className="tile-main" onClick={() => openSheet({ kind: 'drink', date: d.date })}>
            <div className="tile-head">💧 Getränke</div>
            <div className="tile-value">
              {(t.drinkMl / 1000).toLocaleString('de-DE', { maximumFractionDigits: 2 })} <span className="unit">Liter</span>
            </div>
            <Progress value={t.drinkMl} goal={s.goalDrinkMl} />
            <div className="tile-sub">
              {d.drinks.length} Getränk{d.drinks.length === 1 ? '' : 'e'}
              {t.caffeine ? ` · ${t.caffeine}× Koffein` : ''}
            </div>
          </button>
        </div>
      )}
      {show('meals') && (
        <div className="card tile food">
          <button className="tile-main" onClick={() => openSheet({ kind: 'meal', date: d.date })}>
            <div className="tile-head">🍽️ Essen</div>
            <div className="tile-value">
              {d.meals.length} <span className="unit">Mahlzeit{d.meals.length === 1 ? '' : 'en'}</span>
            </div>
            <div className="tile-sub">
              {d.meals.length ? d.meals.map((m) => icon(MEAL_TYPES, m.type)).join(' ') : 'Antippen zum Eintragen'}
            </div>
          </button>
        </div>
      )}
      {show('mood') && (
        <div className="card tile mood">
          <button className="tile-main" onClick={() => openSheet({ kind: 'checkin', date: d.date })}>
            <div className="tile-head">💛 Stimmung</div>
            <div className="tile-value">
              {t.moodAvg != null ? MOOD_FACES[Math.round(t.moodAvg) - 1] : '–'}
              {t.moodAvg != null && <span className="unit"> Ø {t.moodAvg.toLocaleString('de-DE', { maximumFractionDigits: 1 })}</span>}
            </div>
            <div className="tile-sub">{d.checkins.length ? `${d.checkins.length} Check-in${d.checkins.length === 1 ? '' : 's'}` : 'Wie geht es dir?'}</div>
          </button>
        </div>
      )}
      {show('sleep') && (
        <div className="card tile sleep">
          <button className="tile-main" onClick={() => openSheet({ kind: 'sleep', date: d.date })}>
            <div className="tile-head">🌙 Schlaf</div>
            <div className="tile-value">{d.sleep?.durationMin ? minutesToHM(d.sleep.durationMin) : '–'}</div>
            <div className="tile-sub">
              {d.sleep?.bed && d.sleep?.wake ? `${d.sleep.bed} – ${d.sleep.wake}` : 'Letzte Nacht eintragen'}
              {d.sleep?.quality ? ` · Qualität ${d.sleep.quality}/5` : ''}
            </div>
          </button>
        </div>
      )}
      {show('review') && (
        <div className="card tile review">
          <button className="tile-main" onClick={() => openSheet({ kind: 'review', date: d.date })}>
            <div className="tile-head">✨ Tagesrückblick</div>
            <div className="tile-value small-value">
              {d.review ? (
                <>
                  {d.review.outsideMin ? `☀️ ${minutesToHM(d.review.outsideMin)} draußen` : '☀️ –'}
                  <br />
                  {d.review.social ? `🫂 ${label(SOCIAL, d.review.social)}` : '🫂 –'}
                </>
              ) : (
                <span className="unit">Licht, Kontakte, Ereignisse</span>
              )}
            </div>
          </button>
        </div>
      )}
      {show('meds') && (
        <div className="card wide meds">
          <div className="card-head">
            <h3>💊 Medikamente</h3>
            <button className="btn small ghost" onClick={() => openSheet({ kind: 'sideeffect', date: d.date })}>
              + Nebenwirkung
            </button>
          </div>
          {slots.length === 0 ? (
            <p className="muted small">
              Noch keine Medikamente eingetragen.{' '}
              <button className="link" onClick={() => navigate('/medikamente')}>
                Jetzt hinzufügen
              </button>
            </p>
          ) : (
            <ul className="med-slots">
              {slots.map(({ med, slot, intake }) => (
                <li key={`${med.id}-${slot}`} className={intake ? `st-${intake.status}` : ''}>
                  <div className="med-name">
                    <b>{med.name}</b> {med.dose} <span className="muted">· {slot}</span>
                  </div>
                  <div className="med-actions">
                    <button
                      className={'pill' + (intake?.status === 'taken' ? ' on ok' : '')}
                      onClick={() => setIntake(med.id!, d.date, slot, intake?.status === 'taken' ? null : 'taken')}
                    >
                      ✓ Genommen
                    </button>
                    <button
                      className={'pill' + (intake?.status === 'missed' ? ' on miss' : '')}
                      onClick={() => setIntake(med.id!, d.date, slot, intake?.status === 'missed' ? null : 'missed')}
                    >
                      Vergessen
                    </button>
                    <button
                      className={'pill' + (intake?.status === 'skipped' ? ' on skip' : '')}
                      onClick={() => setIntake(med.id!, d.date, slot, intake?.status === 'skipped' ? null : 'skipped')}
                      title="Bewusst ausgelassen"
                    >
                      Ausgelassen
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {show('substances') && (
        <div className="card wide substances">
          <div className="card-head">
            <h3>🍷 Substanzen</h3>
            <button className="btn small ghost" onClick={() => openSheet({ kind: 'substance', date: d.date })}>
              + Eintragen
            </button>
          </div>
          <p className="muted small">
            {d.substances.length
              ? d.substances.map((x) => `${icon(SUBSTANCE_KINDS, x.kind)} ${x.amount}× ${label(SUBSTANCE_KINDS, x.kind)}`).join(' · ')
              : 'Nichts eingetragen'}
            {t.caffeine ? ` · ☕ ${t.caffeine}× Koffein` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

interface TItem {
  key: string
  ts: number
  icon: string
  title: string
  detail?: string
  open?: () => void
}

function Timeline({ d }: { d: DayData }) {
  const items: TItem[] = []
  const o = (kind: SheetKind, id?: number) => () => openSheet({ kind, date: d.date, id })
  for (const m of d.meals)
    items.push({
      key: `m${m.id}`,
      ts: m.ts,
      icon: icon(MEAL_TYPES, m.type),
      title: `${label(MEAL_TYPES, m.type)}${m.what ? `: ${m.what}` : ''}`,
      detail: [label(MEAL_SIZES, m.size), m.grams ? `${m.grams} g` : '', m.note].filter(Boolean).join(' · '),
      open: o('meal', m.id),
    })
  for (const x of d.drinks)
    items.push({ key: `d${x.id}`, ts: x.ts, icon: icon(DRINK_KINDS, x.kind), title: `${label(DRINK_KINDS, x.kind)} ${x.ml} ml`, open: o('drink', x.id) })
  for (const a of d.activities)
    items.push({
      key: `a${a.id}`,
      ts: a.ts,
      icon: icon(ACTIVITY_KINDS, a.kind),
      title: `${label(ACTIVITY_KINDS, a.kind)} · ${minutesToHM(a.minutes)}`,
      detail: [a.joy != null ? `Freude ${a.joy}/10` : '', a.achievement != null ? `Erfolg ${a.achievement}/10` : '', a.note].filter(Boolean).join(' · '),
      open: o('activity', a.id),
    })
  for (const c of d.checkins)
    items.push({
      key: `c${c.id}`,
      ts: c.ts,
      icon: MOOD_FACES[c.mood - 1],
      title: `Stimmung ${c.mood}/5 · Energie ${c.energy}/5`,
      detail: c.note,
      open: o('checkin', c.id),
    })
  for (const x of d.substances)
    items.push({ key: `s${x.id}`, ts: x.ts, icon: icon(SUBSTANCE_KINDS, x.kind), title: `${label(SUBSTANCE_KINDS, x.kind)} ${x.amount}×`, detail: x.note, open: o('substance', x.id) })
  for (const x of d.sideEffects)
    items.push({
      key: `se${x.id}`,
      ts: x.ts,
      icon: '⚠️',
      title: `Nebenwirkung: ${x.kind}`,
      detail: [label(SEVERITY, x.severity), d.meds.find((m) => m.id === x.medId)?.name, x.note].filter(Boolean).join(' · '),
      open: o('sideeffect', x.id),
    })
  for (const i of d.intakes) {
    const m = d.meds.find((mm) => mm.id === i.medId)
    if (!m) continue
    items.push({ key: `i${i.id}`, ts: i.ts, icon: '💊', title: `${m.name} (${i.slot}) ${INTAKE_LABEL[i.status]}` })
  }
  items.sort((a, b) => a.ts - b.ts)
  return (
    <section className="timeline">
      <h2 className="section-title">Verlauf des Tages</h2>
      {items.length === 0 ? (
        <p className="muted small">Noch keine Einträge. Fang einfach mit einem kleinen an – zum Beispiel einem Glas Wasser.</p>
      ) : (
        <ul>
          {items.map((it) => (
            <li key={it.key}>
              <button className="t-item" onClick={it.open} disabled={!it.open}>
                <span className="t-time">{timeStr(it.ts)}</span>
                <span className="t-icon">{it.icon}</span>
                <span className="t-text">
                  <span className="t-title">{it.title}</span>
                  {it.detail && <span className="t-detail">{it.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
