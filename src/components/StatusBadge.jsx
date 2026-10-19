import { coresStatus } from '../data/defaults'
import { useTheme } from '../context/ThemeContext'

export default function StatusBadge({ status }) {
  const { escuro } = useTheme()
  const s = coresStatus(status, escuro)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{ color: s.cor, backgroundColor: s.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.cor }} />
      {s.label}
    </span>
  )
}
