import type { RolPublicacion } from '@/lib/types';

export interface FeedFilters {
  ciudad: string;
  barrio: string;
  rol: '' | RolPublicacion;
}

interface Props {
  ciudades: string[];
  filters: FeedFilters;
  onChange: (filters: FeedFilters) => void;
  total: number;
}

const ROL_OPTIONS: { value: '' | RolPublicacion; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'PERDIDO', label: '🐾 Perdidos' },
  { value: 'BUSCA_DUEÑO', label: '🏠 Rescatados' },
];

/** Filtros rápidos del feed: categoría, ciudad y barrio/zona. */
export function FilterBar({ ciudades, filters, onChange, total }: Props) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-full bg-neutral-200/70 p-1">
        {ROL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ ...filters, rol: option.value })}
            className={`rounded-full px-2 py-2 text-sm font-semibold transition sm:px-3 ${
              filters.rol === option.value
                ? 'bg-white text-neutral-900 shadow'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={filters.ciudad}
          onChange={(e) => onChange({ ...filters, ciudad: e.target.value })}
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        >
          <option value="">📍 Todas las ciudades</option>
          {ciudades.map((ciudad) => (
            <option key={ciudad} value={ciudad}>
              {ciudad}
            </option>
          ))}
        </select>

        <input
          value={filters.barrio}
          onChange={(e) => onChange({ ...filters, barrio: e.target.value })}
          placeholder="Barrio o zona…"
          className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
      </div>

      <p className="text-xs text-neutral-500">
        {total} reporte{total === 1 ? '' : 's'} activo{total === 1 ? '' : 's'}
      </p>
    </div>
  );
}
