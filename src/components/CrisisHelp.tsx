import { Sheet } from './ui'

const CONTACTS = [
  { label: 'TelefonSeelsorge', number: '0800 111 0 111', note: 'kostenlos, anonym, rund um die Uhr' },
  { label: 'TelefonSeelsorge', number: '0800 111 0 222', note: 'kostenlos, anonym, rund um die Uhr' },
  { label: 'TelefonSeelsorge', number: '116 123', note: 'kostenlos, anonym, rund um die Uhr' },
  { label: 'Ärztlicher Bereitschaftsdienst', number: '116 117', note: 'wenn die Praxis geschlossen ist' },
  { label: 'Notruf', number: '112', note: 'bei akuter Gefahr' },
]

const OTHER = [
  { label: 'Österreich: Telefonseelsorge', number: '142' },
  { label: 'Schweiz: Die Dargebotene Hand', number: '143' },
]

export function CrisisContent({ intro = true }: { intro?: boolean }) {
  return (
    <div className="crisis">
      {intro && (
        <p>
          Du musst damit nicht allein sein. Wenn du gerade an Selbstverletzung oder daran denkst, nicht mehr leben zu wollen,
          sprich bitte heute mit jemandem – am Telefon, mit einer vertrauten Person oder mit deinem Arzt.
        </p>
      )}
      <div className="crisis-list">
        {CONTACTS.map((c) => (
          <a key={c.number} className="crisis-item" href={`tel:${c.number.replace(/\s/g, '')}`}>
            <div>
              <div className="crisis-label">{c.label}</div>
              <div className="muted small">{c.note}</div>
            </div>
            <div className="crisis-number">📞 {c.number}</div>
          </a>
        ))}
      </div>
      <p className="small muted">
        Chat & Mail: <a href="https://online.telefonseelsorge.de" target="_blank" rel="noreferrer">online.telefonseelsorge.de</a>
      </p>
      <p className="small muted">
        {OTHER.map((o) => (
          <span key={o.number}>
            {o.label}: <a href={`tel:${o.number}`}>{o.number}</a>
            <br />
          </span>
        ))}
      </p>
    </div>
  )
}

export function CrisisSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="Hilfe, jetzt sofort" onClose={onClose}>
      <CrisisContent />
    </Sheet>
  )
}
