import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Users, MessageSquareText, Send, Settings, Radar } from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', curto: 'Início', icone: LayoutDashboard, exato: true },
  { to: '/buscar', label: 'Buscar', curto: 'Buscar', icone: Radar },
  { to: '/leads', label: 'Leads', curto: 'Leads', icone: Users },
  { to: '/templates', label: 'Templates', curto: 'Modelos', icone: MessageSquareText },
  { to: '/disparo', label: 'Disparo', curto: 'Disparo', icone: Send },
  { to: '/config', label: 'Configurações', curto: 'Config', icone: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-whatsapp text-surface-950 shadow-glow">
        <Send size={18} />
      </div>
      <div className="leading-tight">
        <p className="font-display text-base font-bold text-slate-100">Prospecta</p>
        <p className="text-[11px] text-slate-500">CRM de prospecção</p>
      </div>
    </div>
  )
}

export default function Sidebar() {
  return (
    <>
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-surface-700 bg-surface-900/60 backdrop-blur md:flex">
        <div className="flex h-16 items-center border-b border-surface-700 px-4">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(({ to, label, icone: Icone, exato }) => (
            <NavLink
              key={to}
              to={to}
              end={exato}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-whatsapp/12 text-whatsapp'
                    : 'text-slate-400 hover:bg-surface-800 hover:text-slate-100'
                }`
              }
            >
              <Icone size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-surface-700 p-4 text-[11px] text-slate-500">
          Dados salvos localmente neste navegador.
        </div>
      </aside>

      {/* Bottom nav mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-surface-700 bg-surface-900/95 backdrop-blur md:hidden">
        {NAV.map(({ to, curto, icone: Icone, exato }) => (
          <NavLink
            key={to}
            to={to}
            end={exato}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                isActive ? 'text-whatsapp' : 'text-slate-500 hover:text-slate-300'
              }`
            }
          >
            <Icone size={19} />
            {curto}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
