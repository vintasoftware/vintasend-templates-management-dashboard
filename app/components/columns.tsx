'use client';

import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  Copy,
  Eye,
  FilePlus2,
  History,
  Play,
  Tags as TagsIcon,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ManagedTemplate,
  TemplateOrderByField,
} from 'vintasend-templates-management-dashboard-core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyToClipboard, EMPTY, formatDate } from '@/lib/format';

import { TemplateStatusBadge } from './status-badge';

/** How many tag chips a row shows before it collapses the rest into a count. */
const MAX_VISIBLE_TAGS = 3;

export interface TemplateColumnOptions {
  /** Fields this backend can sort by. Anything absent renders a plain header. */
  sortableFields: TemplateOrderByField[];
  currentSort?: { field?: TemplateOrderByField | null; direction?: 'asc' | 'desc' | null };
  onSort: (field: TemplateOrderByField) => void;

  onViewDetails?: (template: ManagedTemplate) => void;
  onCreateVersion?: (template: ManagedTemplate) => void;
  onPreview?: (template: ManagedTemplate) => void;
  onEditTags?: (template: ManagedTemplate) => void;
  onChangeStatus?: (template: ManagedTemplate) => void;
  onViewHistory?: (template: ManagedTemplate) => void;
  onDelete?: (template: ManagedTemplate) => void;
}

/**
 * A column header that sorts, when the backend can sort by that field.
 *
 * Sorting is not TanStack Table's here — the list is paginated server-side, so
 * a click has to become an `orderByField` on the next request. And it is gated:
 * asking this API to order by a field the backend does not support is a **400**,
 * not an unordered page, so a column whose capability is missing (or still
 * loading) renders as plain text.
 */
function sortableHeader(
  label: string,
  field: TemplateOrderByField,
  options: TemplateColumnOptions,
) {
  const Header = () => {
    if (!options.sortableFields.includes(field)) {
      return <span>{label}</span>;
    }

    const isSorted = options.currentSort?.field === field;
    const Icon = !isSorted
      ? ArrowUpDown
      : options.currentSort?.direction === 'desc'
        ? ArrowDown
        : ArrowUp;

    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 -ml-3"
        onClick={() => options.onSort(field)}
        data-testid={`sort-${field}`}
      >
        {label}
        <Icon className="ml-1 h-3 w-3" />
      </Button>
    );
  };

  Header.displayName = `SortableHeader(${field})`;

  return Header;
}

function TagList({ template }: { template: ManagedTemplate }) {
  if (template.tags.length === 0) {
    return <span className="text-muted-foreground">{EMPTY}</span>;
  }

  const visible = template.tags.slice(0, MAX_VISIBLE_TAGS);
  const hidden = template.tags.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge
          key={tag.slug}
          variant={tag.status === 'archived' ? 'outline' : 'secondary'}
          title={tag.status === 'archived' ? `${tag.text} (archived)` : tag.text}
        >
          {tag.text}
        </Badge>
      ))}
      {hidden > 0 && (
        <span
          className="text-xs text-muted-foreground"
          title={template.tags.map((t) => t.text).join(', ')}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}

/**
 * Column definitions for the templates table.
 *
 * Every row is one *version* of a template — `key` alone does not identify it —
 * so the version number is a column of its own rather than a detail, and the
 * actions that write always name both.
 */
export function createTemplateColumns(
  options: TemplateColumnOptions,
): ColumnDef<ManagedTemplate>[] {
  const {
    onViewDetails,
    onCreateVersion,
    onPreview,
    onEditTags,
    onChangeStatus,
    onViewHistory,
    onDelete,
  } = options;

  return [
    {
      accessorKey: 'key',
      header: sortableHeader('Key', 'key', options),
      cell: ({ row }) => (
        <span className="font-mono text-xs break-all" title={row.original.key}>
          {row.original.key}
        </span>
      ),
      size: 180,
    },

    {
      accessorKey: 'version',
      header: sortableHeader('Version', 'version', options),
      cell: ({ row }) => <span className="tabular-nums text-xs">v{row.original.version}</span>,
      size: 70,
    },

    {
      accessorKey: 'name',
      header: sortableHeader('Name', 'name', options),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 min-w-0">
          <span className="truncate block max-w-[14rem]" title={row.original.name}>
            {row.original.name || EMPTY}
          </span>
          {/* An abstract template is never sent on its own — it exists to be
              extended — so it is worth calling out next to the name. */}
          {row.original.isAbstract && (
            <Badge variant="outline" className="shrink-0">
              abstract
            </Badge>
          )}
        </div>
      ),
      size: 220,
    },

    {
      accessorKey: 'status',
      header: sortableHeader('Status', 'status', options),
      cell: ({ row }) => <TemplateStatusBadge status={row.original.status} />,
      size: 90,
    },

    {
      id: 'tags',
      header: 'Tags',
      cell: ({ row }) => <TagList template={row.original} />,
      size: 200,
    },

    {
      accessorKey: 'templateManagedBackend',
      header: 'Backend',
      cell: ({ row }) => (
        <span
          className="truncate block max-w-[8rem] text-xs"
          title={row.original.templateManagedBackend}
        >
          {row.original.templateManagedBackend || EMPTY}
        </span>
      ),
      size: 120,
    },

    {
      accessorKey: 'updatedAt',
      header: sortableHeader('Updated', 'updatedAt', options),
      cell: ({ row }) => (
        <span className="text-xs whitespace-nowrap">{formatDate(row.original.updatedAt)}</span>
      ),
      size: 130,
    },

    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const template = row.original;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onViewDetails?.(template);
                }}
                disabled={!onViewDetails}
                data-testid={`view-details-${template.id}`}
              >
                <Eye className="h-4 w-4 mr-2" />
                View details
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  void copyToClipboard(template.key).then(() =>
                    toast.success('Template key copied to clipboard'),
                  );
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy key
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onViewHistory?.(template);
                }}
                disabled={!onViewHistory}
                data-testid={`history-${template.id}`}
              >
                <History className="h-4 w-4 mr-2" />
                Status history
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              {/* There is no "edit": a template is versioned, so the edit is a
                  new version with the unchanged fields carried forward. */}
              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onCreateVersion?.(template);
                }}
                disabled={!onCreateVersion}
                data-testid={`new-version-${template.id}`}
              >
                <FilePlus2 className="h-4 w-4 mr-2" />
                New version
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onPreview?.(template);
                }}
                disabled={!onPreview}
                data-testid={`preview-${template.id}`}
              >
                <Play className="h-4 w-4 mr-2" />
                Render preview
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={(event) => {
                  event.stopPropagation();
                  onEditTags?.(template);
                }}
                disabled={!onEditTags}
                data-testid={`edit-tags-${template.id}`}
              >
                <TagsIcon className="h-4 w-4 mr-2" />
                Edit tags
              </DropdownMenuItem>

              {/* Only the transitions the template itself reports are offered.
                  Anything else answers INVALID_STATUS_TRANSITION. */}
              {onChangeStatus && template.allowedTransitions.length > 0 && (
                <DropdownMenuItem
                  onClick={(event) => {
                    event.stopPropagation();
                    onChangeStatus(template);
                  }}
                  data-testid={`change-status-${template.id}`}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Change status
                </DropdownMenuItem>
              )}

              {onDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(template);
                    }}
                    data-testid={`delete-${template.id}`}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete…
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      size: 60,
    },
  ];
}
