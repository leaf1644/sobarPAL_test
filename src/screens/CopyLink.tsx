import { useState } from 'react'
import { copy } from '../copy'

export function CopyLink({ value }: { value: string }) {
  const [note, setNote] = useState('')

  async function onCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        setNote(copy.copied)
        return
      }
    } catch {
      // The next line tells the drinker what to do instead.
    }
    setNote(copy.copyFailed)
  }

  return (
    <div className="link-row">
      <input data-testid="magic-link" readOnly value={value} aria-label={copy.linkLabel} />
      <button type="button" className="hit" onClick={() => void onCopy()}>
        {copy.copyLink}
      </button>
      {note && <p className="quiet">{note}</p>}
    </div>
  )
}
