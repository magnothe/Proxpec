import Modal from './Modal'

export default function ConfirmDialog({
  aberto,
  aoFechar,
  aoConfirmar,
  titulo = 'Confirmar ação',
  mensagem,
  textoConfirmar = 'Confirmar',
  perigo = true,
}) {
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={titulo} largura="max-w-md">
      <p className="text-sm text-content-300">{mensagem}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button className="btn-ghost" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          className={perigo ? 'btn-danger' : 'btn-primary'}
          onClick={() => {
            aoConfirmar?.()
            aoFechar?.()
          }}
        >
          {textoConfirmar}
        </button>
      </div>
    </Modal>
  )
}
