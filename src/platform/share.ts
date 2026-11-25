import { isNative } from './native'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/**
 * Datei teilen bzw. speichern:
 * - Android-App: in den Cache schreiben und über das Android-Teilen-Menü anbieten
 * - iPhone/Browser: Web Share API (Teilen-Menü), sonst normaler Download
 */
export async function shareFile(blob: Blob, filename: string, title: string): Promise<void> {
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const { Share } = await import('@capacitor/share')
    const data = await blobToBase64(blob)
    const res = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
    await Share.share({ title, files: [res.uri], dialogTitle: title })
    return
  }
  const file = new File([blob], filename, { type: blob.type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
