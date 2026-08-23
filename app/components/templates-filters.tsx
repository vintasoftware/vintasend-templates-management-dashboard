'use client';

import { format } from 'date-fns';
import { CalendarIcon, TagIcon, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';
import {
  supportsFilter,
  TEMPLATE_STATUSES,
  useCapabilities,
  useTagsQuery,
  type TemplateFilters,
  type TemplateStatus,
} from 'vintasend-templates-management-dashboard-core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** How long a text input sits still before its value reaches the URL. */
const TEXT_DEBOUNCE_MS = 300;

/** How many tags the picker offers. Above this, the text filters are the tool. */
const TAG_PICKER_PAGE_SIZE = 100;

/**
 * The free-text filters, in the order they are rendered.
 *
 * Each is matched by the most precise string lookup the backend supports, which
 * is why they are plain text boxes rather than exact-match pickers: what
 * `name=welcome` means is the backend's decision, published under
 * `stringLookups.*`.
 */
const TEXT_FIELDS = [
  { key: 'key', label: 'Key', placeholder: 'e.g. welcome-email' },
  { key: 'name', label: 'Name', placeholder: 'Template name' },
  { key: 'description', label: 'Description', placeholder: 'Description' },
  { key: 'templateManagedBackend', label: 'Backend', placeholder: 'e.g. prisma' },
] as const;

type TextFieldKey = (typeof TEXT_FIELDS)[number]['key'];

type TextState = Record<TextFieldKey, string>;

function readTextState(filters: TemplateFilters): TextState {
  return {
    key: filters.key ?? '',
    name: filters.name ?? '',
    description: filters.description ?? '',
    templateManagedBackend: filters.templateManagedBackend ?? '',
  };
}

/**
 * Builds the calendar's range value from the two ISO bounds a filter pair uses.
 * `undefined` is what the date picker treats as "no range chosen".
 */
function toDateRange(from?: string | null, to?: string | null): DateRange | undefined {
  if (!from && !to) return undefined;

  return {
    from: from ? new Date(from) : undefined,
    to: to ? new Date(to) : undefined,
  };
}

function formatDateRange(range: DateRange | undefined): string {
  if (!range?.from) return 'Any date';
  if (!range.to) return format(range.from, 'LLL dd, y');

  return `${format(range.from, 'LLL dd, y')} – ${format(range.to, 'LLL dd, y')}`;
}

export interface TemplatesFiltersProps {
  filters: TemplateFilters;
  hasActiveFilters: boolean;
  isLoading?: boolean;
  patchFilters: (patch: Partial<TemplateFilters>) => void;
  toggleStatus: (status: TemplateStatus) => void;
  toggleTag: (tag: string, mode?: 'all' | 'any') => void;
  clearFilters: () => void;
}

/**
 * Filter bar for the templates list.
 *
 * The URL owns the filter state — every control here calls back into
 * `useFilteredTemplates`, which writes to the query string and re-renders from
 * it. Only the text boxes keep a local copy, and only so they stay responsive
 * ahead of their debounce.
 *
 * Controls for filters the backend cannot honour are not rendered at all. An
 * unsupported filter is **dropped by the server**, so the response simply comes
 * back with more rows than were asked for — an input that silently does nothing
 * is worse than no input.
 */
export function TemplatesFilters({
  filters,
  hasActiveFilters,
  isLoading = false,
  patchFilters,
  toggleStatus,
  toggleTag,
  clearFilters,
}: TemplatesFiltersProps) {
  const capabilities = useCapabilities().data?.data;

  const supports = useCallback(
    (field: string) => supportsFilter(capabilities, `fields.${field}`),
    [capabilities],
  );

  // Archived tags stay attached to the templates carrying them and remain
  // filterable, they are simply no longer offered — so the picker asks for the
  // active ones only.
  const tagsQuery = useTagsQuery(
    { status: ['active'], pageSize: TAG_PICKER_PAGE_SIZE },
    { query: { enabled: supports('includesAllTags') || supports('includesAnyOfTags') } },
  );

  const availableTags = tagsQuery.data?.data ?? [];

  const tagMode: 'all' | 'any' = filters.includesAnyOfTags?.length ? 'any' : 'all';

  // Memoised because `setTagMode` closes over it: a fresh array every render
  // would rebuild that callback on every keystroke elsewhere in the bar.
  const selectedTags = useMemo(
    () => (tagMode === 'all' ? filters.includesAllTags : filters.includesAnyOfTags) ?? [],
    [tagMode, filters.includesAllTags, filters.includesAnyOfTags],
  );

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

  /**
   * The URL can change without this bar doing anything: the back button, a
   * shared link, the page's "clear filters". Re-seed the inputs when that
   * happens — but not when the incoming value is simply the one this component
   * just emitted, or every keystroke would round-trip through the URL and
   * overwrite what is still being typed.
   */
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

  const setDateRange = useCallback(
    (
      fromKey: keyof TemplateFilters,
      toKey: keyof TemplateFilters,
      range: DateRange | undefined,
    ) => {
      patchFilters({
        [fromKey]: range?.from ? range.from.toISOString() : undefined,
        [toKey]: range?.to ? range.to.toISOString() : undefined,
      });
    },
    [patchFilters],
  );

  /**
   * Switching between "has every tag" and "has any of these" carries the
   * current selection across, since the two filters are separate parameters and
   * the user is changing how their choice is read, not unmaking it.
   */
  const setTagMode = useCallback(
    (mode: 'all' | 'any') => {
      if (mode === tagMode) return;

      patchFilters({
        includesAllTags: mode === 'all' && selectedTags.length ? [...selectedTags] : undefined,
        includesAnyOfTags: mode === 'any' && selectedTags.length ? [...selectedTags] : undefined,
      });
    },
    [patchFilters, tagMode, selectedTags],
  );

  const createdRange = toDateRange(filters.createdAtFrom, filters.createdAtTo);
  const updatedRange = toDateRange(filters.updatedAtFrom, filters.updatedAtTo);

  const showTagPicker = supports('includesAllTags') || supports('includesAnyOfTags');

  return (
    <div
      className="flex flex-col gap-4 p-4 border border-input rounded-lg bg-background"
      data-testid="templates-filters"
    >
      {/* Status is a repeated parameter, so it is a set of toggles rather than a
          select: a template list is usually "draft and active" rather than one. */}
      {supports('status') && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1">Status</span>
          {TEMPLATE_STATUSES.map((status) => {
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
                data-testid={`filter-status-${status}`}
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
              data-testid="clear-filters"
            >
              <X className="h-3 w-3" />
              Clear filters
            </Button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-2">
        {TEXT_FIELDS.filter((field) => supports(field.key)).map((field) => (
          <div key={field.key} className="flex-1 min-w-0">
            <Label htmlFor={`filter-${field.key}`} className="text-muted-foreground mb-2">
              {field.label}
            </Label>
            <Input
              id={`filter-${field.key}`}
              placeholder={field.placeholder}
              value={text[field.key]}
              onChange={(event) => setTextFilter(field.key, event.target.value)}
              disabled={isLoading}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-2">
        {showTagPicker && (
          <div className="w-full sm:w-auto">
            <Label className="text-muted-foreground mb-2">Tags</Label>
            <div className="flex items-center gap-1">
              <Select
                value={tagMode}
                onValueChange={(value) => setTagMode(value as 'all' | 'any')}
                disabled={isLoading}
              >
                <SelectTrigger className="w-[9rem]" data-testid="filter-tag-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Has all of</SelectItem>
                  <SelectItem value="any">Has any of</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start px-2.5 font-normal"
                    disabled={isLoading}
                    data-testid="filter-tags-trigger"
                  >
                    <TagIcon className="size-4" />
                    {selectedTags.length > 0 ? `${selectedTags.length} selected` : 'Any tag'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="start">
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {tagsQuery.isLoading && (
                      <p className="text-sm text-muted-foreground p-2">Loading tags…</p>
                    )}
                    {!tagsQuery.isLoading && availableTags.length === 0 && (
                      <p className="text-sm text-muted-foreground p-2">No active tags yet.</p>
                    )}
                    {availableTags.map((tag) => (
                      <label
                        key={tag.slug}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag.slug)}
                          onCheckedChange={() => toggleTag(tag.slug, tagMode)}
                          data-testid={`filter-tag-${tag.slug}`}
                        />
                        <span className="truncate">{tag.text}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {supports('version') && (
          <div className="w-full sm:w-32">
            <Label htmlFor="filter-version" className="text-muted-foreground mb-2">
              Version
            </Label>
            <Input
              id="filter-version"
              type="number"
              min={1}
              placeholder="Any"
              value={filters.version ?? ''}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);

                patchFilters({ version: Number.isNaN(parsed) ? undefined : parsed });
              }}
              disabled={isLoading}
            />
          </div>
        )}

        {supports('isAbstract') && (
          <div className="w-full sm:w-40">
            <Label htmlFor="filter-abstract" className="text-muted-foreground mb-2">
              Abstract
            </Label>
            <Select
              value={
                filters.isAbstract === undefined || filters.isAbstract === null
                  ? 'any'
                  : String(filters.isAbstract)
              }
              onValueChange={(value) =>
                patchFilters({ isAbstract: value === 'any' ? undefined : value === 'true' })
              }
              disabled={isLoading}
            >
              <SelectTrigger id="filter-abstract" data-testid="filter-abstract">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="true">Abstract only</SelectItem>
                <SelectItem value="false">Concrete only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {supports('createdAtFrom') && (
          <div className="w-full sm:w-auto">
            <Label className="text-muted-foreground mb-2">Created</Label>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start px-2.5 font-normal w-full sm:w-auto"
                    disabled={isLoading}
                    data-testid="filter-created-range"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="truncate">{formatDateRange(createdRange)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={createdRange?.from}
                    selected={createdRange}
                    onSelect={(range) => setDateRange('createdAtFrom', 'createdAtTo', range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {createdRange && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDateRange('createdAtFrom', 'createdAtTo', undefined)}
                  disabled={isLoading}
                  aria-label="Clear created date filter"
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {supports('updatedAtFrom') && (
          <div className="w-full sm:w-auto">
            <Label className="text-muted-foreground mb-2">Updated</Label>
            <div className="flex items-center gap-1">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="justify-start px-2.5 font-normal w-full sm:w-auto"
                    disabled={isLoading}
                    data-testid="filter-updated-range"
                  >
                    <CalendarIcon className="size-4" />
                    <span className="truncate">{formatDateRange(updatedRange)}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={updatedRange?.from}
                    selected={updatedRange}
                    onSelect={(range) => setDateRange('updatedAtFrom', 'updatedAtTo', range)}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
              {updatedRange && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => setDateRange('updatedAtFrom', 'updatedAtTo', undefined)}
                  disabled={isLoading}
                  aria-label="Clear updated date filter"
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* A row in the store is a version, so the list collapses to one row per
          key unless this is on. `undefined` rather than `true` when off: the
          server applies the default, and the URL stays clean. */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={filters.mostRecentActiveVersion === false}
            onCheckedChange={(checked) =>
              patchFilters({ mostRecentActiveVersion: checked === true ? false : undefined })
            }
            disabled={isLoading}
            data-testid="filter-all-versions"
          />
          Show every version
        </label>

        {selectedTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTags.map((slug) => (
              <Badge key={slug} variant="secondary" className="gap-1">
                {slug}
                <button
                  type="button"
                  onClick={() => toggleTag(slug, tagMode)}
                  aria-label={`Remove tag filter ${slug}`}
                  className="cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
