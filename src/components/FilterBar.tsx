import { DEPARTAMENTOS_NOMBRES, municipiosDe } from '@/lib/colombia';
import type { CategoriaFeed } from '@/lib/types';

export interface FeedFilters {
  categoria: CategoriaFeed;
  departamento: string;
  ciudad: string;
  barrio: string;
}

interface Props {
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  total: number;
}

const CATEGORIAS: { value: CategoriaFeed; label: string }[] = [
  { value: 'todos', label: '🗂️ Todos' },
  { value: 'buscadas', label: '🐾 Se buscan' },
  { value: 'buscan-dueno', label: '🏠 Buscan su dueño' },
  { value: 'encontradas', label: '✅ Encontradas' },
];

const selectCls =
  'flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

/**
 * Filtros del feed: categoría (Se buscan / Buscan su dueño /
 * Encontradas), departamento → municipio (Colombia) y dirección/barrio.
 */
export function FilterBar({ filters, onChange, total }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-neutral-200/70 p-1 sm:grid-cols-4">
        {CATEGORIAS.map((categoria) => (
          <button
            key={categoria.value}
            type="button"
            onClick={() => onChange({ ...filters, categoria: categoria.value })}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
              filters.categoria === categoria.value
                ? 'bg-white text-neutral-900 shadow'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {categoria.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={filters.departamento}
          onChange={(e) => onChange({ ...filters, departamento: e.target.value, ciudad: '' })}
          className={selectCls}
        >
          <option value="">📍 Todos los departamentos</option>
          {DEPARTAMENTOS_NOMBRES.map((departamento) => (
            <option key={departamento} value={departamento}>
              {departamento}
            </option>
          ))}
        </select>

        <select
          value={filters.ciudad}
          onChange={(e) => onChange({ ...filters, ciudad: e.target.value })}
          className={selectCls}
          disabled={!filters.departamento}
        >
          <option value="">
            {filters.departamento ? 'Todos los municipios' : 'Elige un departamento primero'}
          </option>
          {municipiosDe(filters.departamento).map((municipio) => (
            <option key={municipio} value={municipio}>
              {municipio}
            </option>
          ))}
        </select>
      </div>

      <input
        value={filters.barrio}
        onChange={(e) => onChange({ ...filters, barrio: e.target.value })}
        placeholder="Dirección / barrio…"
        className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
      />

      <p className="text-xs text-neutral-500">
        {total} reporte{total === 1 ? '' : 's'} en esta categoría
      </p>
    </div>
  );
}