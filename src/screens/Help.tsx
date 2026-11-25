import { CrisisContent } from '../components/CrisisHelp'

export function HelpScreen() {
  return (
    <div className="screen">
      <header className="page-header">
        <h1>Hilfe in Krisen</h1>
      </header>
      <div className="card">
        <CrisisContent />
      </div>
    </div>
  )
}
