export default function EmptyState({ icone: Icone, titulo, descricao, acao }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {Icone && (
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-800 text-slate-500">
          <Icone size={26} />
        </div>
      )}
      <div>
        <p className="font-medium text-slate-200">{titulo}</p>
        {descricao && <p className="mt-1 text-sm text-slate-500">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}
