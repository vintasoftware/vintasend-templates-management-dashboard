'use client';

import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Pencil,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ManagedTemplateTag } from 'vintasend-templates-management-dashboard-core';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { copyToClipboard, EMPTY, formatDate } from '@/lib/format';

import { TagStatusBadge } from './status-badge';

const COLUMN_COUNT = 6;

export interface TagsTableProps {
  data: ManagedTemplateTag[];
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  isLoading?: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
  onRename: (tag: ManagedTemplateTag) => void;
  onArchive: (tag: ManagedTemplateTag) => void;
  onRestore: (tag: ManagedTemplateTag) => void;
  onDelete: (tag: ManagedTemplateTag) => void;
}

/**
 * The tags table.
 *
 * Plain markup rather than TanStack Table: this list has no sorting, no
 * selection and six fixed columns, so the headless table would be scaffolding
 * around a `map`. The templates table earns it; this one does not.
 */
export function TagsTable({
  data,
  page,
  pageSize,
  hasNextPage,
  hasPreviousPage,
  isLoading = false,
  onNextPage,
  onPreviousPage,
  onRename,
  onArchive,
  onRestore,
  onDelete,
}: TagsTableProps) {
  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-2 px-3 text-xs">Name</TableHead>
              <TableHead className="py-2 px-3 text-xs">Slug</TableHead>
              <TableHead className="py-2 px-3 text-xs">Status</TableHead>
              <TableHead className="py-2 px-3 text-xs">Tenant</TableHead>
              <TableHead className="py-2 px-3 text-xs">Created</TableHead>
              <TableHead className="py-2 px-3 text-xs">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: Math.min(pageSize, 10) }).map((_, rowIndex) => (
                <TableRow key={`skeleton-row-${rowIndex}`}>
                  {Array.from({ length: COLUMN_COUNT }).map((_cell, cellIndex) => (
                    <TableCell key={`skeleton-cell-${rowIndex}-${cellIndex}`} className="py-2 px-3">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && data.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="h-24 text-center text-muted-foreground"
                >
                  No tags found.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              data.map((tag) => (
                <TableRow key={tag.id} data-testid={`tag-row-${tag.slug}`}>
                  <TableCell className="py-2 px-3">
                    <span className="truncate block max-w-[14rem]" title={tag.text}>
                      {tag.text}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <span className="font-mono text-xs break-all">{tag.slug}</span>
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <TagStatusBadge status={tag.status} />
                  </TableCell>
                  <TableCell className="py-2 px-3 text-xs">{tag.tenant || EMPTY}</TableCell>
                  <TableCell className="py-2 px-3 text-xs whitespace-nowrap">
                    {formatDate(tag.createdAt)}
                  </TableCell>
                  <TableCell className="py-2 px-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          onClick={() => {
                            void copyToClipboard(tag.slug).then(() =>
                              toast.success('Tag slug copied to clipboard'),
                            );
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy slug
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          onClick={() => onRename(tag)}
                          data-testid={`rename-tag-${tag.slug}`}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Rename…
                        </DropdownMenuItem>

                        {tag.status === 'active' ? (
                          <DropdownMenuItem
                            onClick={() => onArchive(tag)}
                            data-testid={`archive-tag-${tag.slug}`}
                          >
                            <Archive className="h-4 w-4 mr-2" />
                            Archive
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => onRestore(tag)}
                            data-testid={`restore-tag-${tag.slug}`}
                          >
                            <ArchiveRestore className="h-4 w-4 mr-2" />
                            Restore
                          </DropdownMenuItem>
                        )}

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => onDelete(tag)}
                          data-testid={`delete-tag-${tag.slug}`}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete…
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

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
