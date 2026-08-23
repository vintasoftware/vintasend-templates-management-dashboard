'use client';

import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  TAG_STATUSES,
  type TagFilters,
  type TagStatus,
} from 'vintasend-templates-management-dashboard-core';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const TEXT_DEBOUNCE_MS = 300;

const TEXT_FIELDS = [
  { key: 'search', label: 'Search', placeholder: 'Tag name' },
  { key: 'tenant', label: 'Tenant', placeholder: 'Tenant' },
] as const;

type TextFieldKey = (typeof TEXT_FIELDS)[number]['key'];

type TextState = Record<TextFieldKey, string>;

function readTextState(filters: TagFilters): TextState {
  return { search: filters.search ?? '', tenant: filters.tenant ?? '' };
}

export interface TagsFiltersProps {
  filters: TagFilters;
  hasActiveFilters: boolean;
  isLoading?: boolean;
  patchFilters: (patch: Partial<TagFilters>) => void;
  toggleStatus: (status: TagStatus) => void;
  clearFilters: () => void;
}

/**
 * Filter bar for the tags list.
 *
 * The same URL-as-state arrangement as the templates bar, on a much smaller
 * surface: this endpoint filters on a status set, a text search and a tenant,
 * and nothing else.
 */
export function TagsFilters({
  filters,
  hasActiveFilters,
  isLoading = false,
  patchFilters,
  toggleStatus,
  clearFilters,
}: TagsFiltersProps) {
  const [text, setText] = useState<TextState>(() => readTextState(filters));

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEmitted = useRef<string | null>(null);

  const externalText = JSON.stringify(readTextState(filters));
  const lastSynced = useRef<string>(externalText);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  useEffect(() => {
    if (externalText === lastSynced.current) return;
    lastSynced.current = externalText;

    if (externalText === lastEmitted.current) return;

    setText(JSON.parse(externalText) as TextState);
  }, [externalText]);

  const setTextFilter = useCallback(
    (key: TextFieldKey, value: string) => {
      const next = { ...text, [key]: value };

      setText(next);
      lastEmitted.current = JSON.stringify(next);

      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      debounceTimer.current = setTimeout(() => {
        const trimmed = value.trim();

        patchFilters({ [key]: trimmed === '' ? undefined : trimmed });
      }, TEXT_DEBOUNCE_MS);
    },
    [text, patchFilters],
  );

  return (
    <div
      className="flex flex-col gap-4 p-4 border border-input rounded-lg bg-background"
      data-testid="tags-filters"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground mr-1">Status</span>
        {TAG_STATUSES.map((status) => {
          const active = filters.status?.includes(status) ?? false;

          return (
            <Button
              key={status}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => toggleStatus(status)}
              disabled={isLoading}
              aria-pressed={active}
              data-testid={`filter-tag-status-${status}`}
            >
              {status}
            </Button>
          );
        })}

        {hasActiveFilters && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={clearFilters}
            disabled={isLoading}
            data-testid="clear-tag-filters"
          >
            <X className="h-3 w-3" />
            Clear filters
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-2">
        {TEXT_FIELDS.map((field) => (
          <div key={field.key} className="flex-1 min-w-0">
            <Label htmlFor={`tag-filter-${field.key}`} className="text-muted-foreground mb-2">
              {field.label}
            </Label>
            <Input
              id={`tag-filter-${field.key}`}
              placeholder={field.placeholder}
              value={text[field.key]}
              onChange={(event) => setTextFilter(field.key, event.target.value)}
              disabled={isLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
