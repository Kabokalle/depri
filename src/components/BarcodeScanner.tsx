import { useEffect, useRef, useState } from 'react'
import { isValidBarcode } from '../lib/food'

type Detect = (source: HTMLVideoElement | ImageData) => Promise<string | null>

const FORMATS_NATIVE = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/** Native BarcodeDetector (Android/Chrome) – sonst zxing-wasm (iPhone/Safari), lokal gebündelt */
async function createDetector(): Promise<{ detect: Detect; needsImageData: boolean }> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): { detect: (s: unknown) => Promise<{ rawValue: string }[]> }; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  if (BD) {
    try {
      const supported = (await BD.getSupportedFormats?.()) ?? []
      const formats = FORMATS_NATIVE.filter((f) => supported.includes(f))
      if (formats.length) {
        const d = new BD({ formats })
        return {
          needsImageData: false,
          detect: async (src) => (await d.detect(src))[0]?.rawValue ?? null,
        }
      }
    } catch {
      /* Fallback */
    }
  }
  const [{ readBarcodes, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('zxing-wasm/reader'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ])
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
    fireImmediately: true,
  })
  return {
    needsImageData: true,
    detect: async (src) => {
      const r = await readBarcodes(src as ImageData, { formats: ['EAN13', 'EAN8', 'UPCA', 'UPCE'], tryHarder: true, maxNumberOfSymbols: 1 })
      return r.find((x) => x.isValid)?.text ?? null
    },
  }
}

export function BarcodeScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<'starting' | 'scanning' | 'denied' | 'nocamera'>('starting')
  const [manual, setManual] = useState('')
  const done = useRef(false)

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopped = false
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d', { willReadFrequently: true })

    ;(async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('nocamera')
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch (e) {
        setStatus((e as Error).name === 'NotAllowedError' ? 'denied' : 'nocamera')
        return
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }
      const v = videoRef.current!
      v.srcObject = stream
      await v.play().catch(() => {})
      setStatus('scanning')
      const { detect, needsImageData } = await createDetector()

      const tick = async () => {
        if (stopped || done.current) return
        try {
          if (v.readyState >= 2 && v.videoWidth) {
            let code: string | null
            if (needsImageData && ctx) {
              // mittleren Bereich ausschneiden und verkleinern – schneller und genauer
              const w = v.videoWidth
              const h = v.videoHeight
              const cw = Math.round(w * 0.8)
              const ch = Math.round(h * 0.5)
              const scale = Math.min(1, 960 / cw)
              canvas.width = Math.round(cw * scale)
              canvas.height = Math.round(ch * scale)
              ctx.drawImage(v, (w - cw) / 2, (h - ch) / 2, cw, ch, 0, 0, canvas.width, canvas.height)
              code = await detect(ctx.getImageData(0, 0, canvas.width, canvas.height))
            } else {
              code = await detect(v)
            }
            if (code && isValidBarcode(code) && !done.current) {
              done.current = true
              navigator.vibrate?.(60)
              onResult(code)
              return
            }
          }
        } catch (e) {
          console.warn(e)
        }
        timer = window.setTimeout(tick, 180)
      }
      tick()
    })()

    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [onResult])

  const submitManual = () => {
    const c = manual.replace(/\D/g, '')
    if (isValidBarcode(c)) {
      done.current = true
      onResult(c)
    }
  }

  return (
    <div className="scanner" role="dialog" aria-label="Barcode scannen">
      <video ref={videoRef} playsInline muted autoPlay className="scanner-video" />
      <div className="scanner-frame" aria-hidden="true">
        <div className="scanner-line" />
      </div>
      <div className="scanner-top">
        <button className="icon-btn light" onClick={onClose} aria-label="Schließen">
          ✕
        </button>
      </div>
      <div className="scanner-bottom">
        <p className="scanner-hint">
          {status === 'starting' && 'Kamera wird gestartet …'}
          {status === 'scanning' && 'Halte den Barcode in den Rahmen'}
          {status === 'denied' && 'Kein Kamerazugriff. Erlaube die Kamera in den Einstellungen oder gib die Nummer ein.'}
          {status === 'nocamera' && 'Keine Kamera verfügbar. Gib die Nummer unter dem Barcode ein.'}
        </p>
        <div className="row-inline scanner-manual">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Nummer eingeben, z. B. 5449000000996"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitManual()}
          />
          <button className="btn primary" onClick={submitManual} disabled={!isValidBarcode(manual.replace(/\D/g, ''))}>
            OK
          </button>
        </div>
      </div>
    </div>
  )
}
