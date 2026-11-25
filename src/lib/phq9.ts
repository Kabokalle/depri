/**
 * PHQ-9 / Gesundheitsfragebogen für Patienten (PHQ-D), deutsche Fassung.
 * Entwickelt von Spitzer, Williams, Kroenke et al.; frei nutzbar, keine Genehmigung erforderlich.
 */
export const PHQ_INTRO =
  'Wie oft fühlten Sie sich im Verlauf der letzten 2 Wochen durch die folgenden Beschwerden beeinträchtigt?'

export const PHQ_ITEMS = [
  'Wenig Interesse oder Freude an Ihren Tätigkeiten',
  'Niedergeschlagenheit, Schwermut oder Hoffnungslosigkeit',
  'Schwierigkeiten, ein- oder durchzuschlafen, oder vermehrter Schlaf',
  'Müdigkeit oder Gefühl, keine Energie zu haben',
  'Verminderter Appetit oder übermäßiges Bedürfnis zu essen',
  'Schlechte Meinung von sich selbst; Gefühl, ein Versager zu sein oder die Familie enttäuscht zu haben',
  'Schwierigkeiten, sich auf etwas zu konzentrieren, z. B. beim Zeitunglesen oder Fernsehen',
  'Waren Ihre Bewegungen oder Ihre Sprache so verlangsamt, dass es auch anderen auffallen würde? Oder waren Sie im Gegenteil „zappelig“ oder ruhelos und hatten dadurch einen stärkeren Bewegungsdrang als sonst?',
  'Gedanken, dass Sie lieber tot wären oder sich Leid zufügen möchten',
]

export const PHQ_SHORT = [
  'Interesse/Freude',
  'Niedergeschlagenheit',
  'Schlaf',
  'Energie',
  'Appetit',
  'Selbstwert',
  'Konzentration',
  'Psychomotorik',
  'Gedanken an Tod/Selbstverletzung',
]

export const PHQ_OPTIONS = ['Überhaupt nicht', 'An einzelnen Tagen', 'An mehr als der Hälfte der Tage', 'Beinahe jeden Tag']

export const PHQ_DIFFICULTY_Q =
  'Wenn eine oder mehrere dieser Beschwerden bei Ihnen vorliegen: Wie sehr haben diese Probleme es Ihnen erschwert, Ihre Arbeit zu erledigen, Ihren Haushalt zu regeln oder mit anderen Menschen zurechtzukommen?'
export const PHQ_DIFFICULTY = ['Überhaupt nicht erschwert', 'Etwas erschwert', 'Relativ stark erschwert', 'Sehr stark erschwert']

export function phqSeverity(score: number): { label: string; level: number } {
  if (score <= 4) return { label: 'minimal', level: 0 }
  if (score <= 9) return { label: 'leicht', level: 1 }
  if (score <= 14) return { label: 'mittelgradig', level: 2 }
  if (score <= 19) return { label: 'ausgeprägt', level: 3 }
  return { label: 'schwer', level: 4 }
}

export const PHQ_BANDS = [
  { from: 0, to: 4.99, className: 'band b0' },
  { from: 5, to: 9.99, className: 'band b1' },
  { from: 10, to: 14.99, className: 'band b2' },
  { from: 15, to: 19.99, className: 'band b3' },
  { from: 20, to: 27, className: 'band b4' },
]
