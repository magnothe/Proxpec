export default function PageHeader({ titulo, subtitulo, acoes }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-bold text-content-100 sm:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-content-400">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
    </div>
  )
}
