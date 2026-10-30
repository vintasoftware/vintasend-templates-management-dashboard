'use client';
'use no memo';

import { flexRender, useTable } from '@tanstack/react-table';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ManagedTemplate } from 'vintasend-templates-management-dashboard-core';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  createTemplateColumns,
  type TemplateColumnOptions,
  templateTableFeatures,
} from './columns';

export interface TemplatesTableProps extends TemplateColumnOptions {
  data: ManagedTemplate[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading?: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRowClick?: (template: ManagedTemplate) => void;
}

/**
 * The templates table.
 *
 * TanStack Table is used purely as a headless renderer: the list is paginated,
 * filtered and sorted by the API, so no row model beyond the core one is
 * registered and sorting is handled by the column headers calling back into the
 * URL filters rather than by the table's own state.
 */
export function TemplatesTable({
  data,
  page,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  isLoading = false,
  onNextPage,
  onPreviousPage,
  onRowClick,
  ...columnOptions
}: TemplatesTableProps) {
  const columns = createTemplateColumns(columnOptions);

  const table = useTable({
    features: templateTableFeatures,
    data,
    columns,
    // A row is a version, so `key` is not unique when every version is shown.
    getRowId: (row) => row.id,
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="py-2 px-3 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: Math.min(pageSize, 10) }).map((_, rowIndex) => (
                <TableRow
                  // biome-ignore lint/suspicious/noArrayIndexKey: static loading placeholders that are never reordered, so their position is their identity.
                  key={`skeleton-row-${rowIndex}`}
                >
                  {table.getAllLeafColumns().map((column) => (
                    <TableCell key={column.id} className="py-2 px-3">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No templates found.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-testid={`template-row-${row.original.key}-v${row.original.version}`}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 px-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* The API reports `hasMore` rather than a total count — a backend is not
          required to be able to count — so there is a next-page flag but no
          page count to render. */}
      {(hasPreviousPage || hasNextPage) && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-muted-foreground">Page {page}</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPreviousPage}
              disabled={!hasPreviousPage || isLoading}
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onNextPage}
              disabled={!hasNextPage || isLoading}
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
