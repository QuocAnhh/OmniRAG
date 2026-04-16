import { Search, X } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { typeColor, typeLabel } from './types';

interface GraphFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  searchHitCount: number;
  topN: number;
  onTopNChange: (v: number) => void;
  maxSlider: number;
  hoveredLabel: string | null;
  graphOrder: number;
  graphSize: number;
  typeCounts: Record<string, number>;
  hiddenTypes: Set<string>;
  onToggleType: (type: string) => void;
}

export function GraphFilters({
  searchQuery,
  onSearchChange,
  searchHitCount,
  topN,
  onTopNChange,
  maxSlider,
  hoveredLabel,
  graphOrder,
  graphSize,
  typeCounts,
  hiddenTypes,
  onToggleType,
}: GraphFiltersProps) {
  return (
    <>
      {/* Search bar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border-warm shrink-0">
        <Search className="size-3 text-text-tertiary" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search entities..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search entities in graph"
          className="flex-1 bg-transparent border-none outline-none text-[11px] text-text-primary placeholder:text-text-tertiary"
        />
        {searchHitCount > 0 && (
          <span className="whitespace-nowrap text-[10px] font-bold text-yellow-600">
            {searchHitCount} found
          </span>
        )}
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="text-warm-stone hover:text-text-primary p-0 leading-none text-xs"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Density slider */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-warm shrink-0">
        <span className="text-[11px] text-warm-stone whitespace-nowrap">
          Density
        </span>
        <input
          type="range"
          min={1}
          max={maxSlider}
          value={topN}
          onChange={(e) => onTopNChange(+e.target.value)}
          aria-label="Graph density"
          style={{ accentColor: '#c96442' }}
          className="flex-1 cursor-pointer"
        />
        <span className="text-[11px] text-warm-stone whitespace-nowrap">
          {graphOrder}n / {graphSize}e
        </span>
        {hoveredLabel && (
          <span className="max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-orange-600">
            {hoveredLabel}
          </span>
        )}
      </div>

      {/* Type filter pills */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="flex flex-wrap gap-1 px-2.5 py-1.5 border-b border-border-warm shrink-0">
          {Object.entries(typeCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => {
              const hidden = hiddenTypes.has(type);
              const color = typeColor(type);
              const label = typeLabel(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  aria-pressed={!hidden}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5',
                    'text-[10px] font-semibold transition-colors border-none cursor-pointer',
                    hidden ? 'opacity-55' : 'opacity-100',
                  )}
                  style={{
                    background: hidden ? '#e8e6dc' : `${color}22`,
                    color: hidden ? '#4b5563' : color,
                  }}
                >
                  <span
                    className="size-1.5 rounded-full shrink-0"
                    style={{ background: hidden ? '#4b5563' : color }}
                  />
                  {label}
                  <span className="opacity-70">{count}</span>
                </button>
              );
            })}
        </div>
      )}
    </>
  );
}
