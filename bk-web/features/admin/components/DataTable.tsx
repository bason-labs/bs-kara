'use client';

import { useMemo, useState, type ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  align?: 'left' | 'right';
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  defaultSortKey?: string;
  defaultSortDir?: 'asc' | 'desc';
  rowKey: (row: T) => string;
  emptyMessage: string;
}

// Minimal Tailwind table. Generic over row type. Client-side sorting; no
// pagination (Phase 1 dataset is small). Empty state shows the supplied
// message centred in a single body row.
export function DataTable<T>({
  columns,
  data,
  defaultSortKey,
  defaultSortDir = 'asc',
  rowKey,
  emptyMessage,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col || !col.sortable || !col.sortValue) return data;
    const getVal = col.sortValue;
    const copy = [...data];
    copy.sort((a, b) => {
      const va = getVal(a);
      const vb = getVal(b);
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [data, columns, sortKey, sortDir]);

  function handleHeaderClick(col: DataTableColumn<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col.key);
      setSortDir('asc');
    }
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl border border-border bg-surface/60 backdrop-blur-md">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-[0.16em] text-muted">
          <tr>
            {columns.map((col) => {
              const active = sortKey === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={
                    'px-4 py-3 font-medium ' +
                    (col.align === 'right' ? 'text-right' : 'text-left') +
                    (col.sortable ? ' cursor-pointer select-none hover:text-fg' : '')
                  }
                  onClick={() => handleHeaderClick(col)}
                  aria-sort={
                    !col.sortable
                      ? undefined
                      : active
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                  }
                >
                  <span>
                    {col.label}
                    {col.sortable && active && (
                      <span aria-hidden className="ml-1 text-fg">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sorted.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-muted"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-bg/40">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={
                      'px-4 py-3 ' +
                      (col.align === 'right' ? 'text-right' : 'text-left')
                    }
                  >
                    {col.render
                      ? col.render(row)
                      : String(
                          (row as unknown as Record<string, unknown>)[col.key] ?? '',
                        )}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
