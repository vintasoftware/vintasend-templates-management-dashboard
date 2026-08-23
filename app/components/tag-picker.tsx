'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useCreateTag,
  useTagsQuery,
} from 'vintasend-templates-management-dashboard-core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

/** Tags offered in one go. Beyond this, the tags screen is the tool. */
const TAG_PAGE_SIZE = 100;

export interface TagPickerProps {
  /** Selected tag **slugs** — the tag's identity, and what the API matches on. */
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  /** Offers an inline "create tag" box. */
  allowCreate?: boolean;
}

/**
 * Picks tags by slug.
 *
 * Only active tags are offered: an archived tag stays attached to whatever
 * carries it and stays filterable, it is simply out of circulation. A selection
 * that already includes an archived slug is preserved rather than silently
 * dropped — it is still shown as a chip below the list.
 */
export function TagPicker({ value, onChange, disabled = false, allowCreate = false }: TagPickerProps) {
  const { data, isLoading } = useTagsQuery({ status: ['active'], pageSize: TAG_PAGE_SIZE });
  const createTag = useCreateTag();

  const [newTagText, setNewTagText] = useState('');

  const tags = data?.data ?? [];
  const offeredSlugs = new Set(tags.map((tag) => tag.slug));
  const selectedButNotOffered = value.filter((slug) => !offeredSlugs.has(slug));

  const toggle = (slug: string) => {
    onChange(value.includes(slug) ? value.filter((entry) => entry !== slug) : [...value, slug]);
  };

  const handleCreate = async () => {
    const text = newTagText.trim();

    if (!text) return;

    try {
      // The slug is derived from `text` by the server and is not a client's to
      // guess, so the new tag is read back off the response before selecting it.
      const created = await createTag.mutateAsync({ body: { text } });

      onChange([...value, created.data.slug]);
      setNewTagText('');
      toast.success(`Tag “${created.data.text}” created.`);
    } catch (error) {
      toast.error(`Could not create the tag: ${getApiErrorMessage(error)}`);
    }
  };

  return (
    <div className="space-y-2" data-testid="tag-picker">
      <div className="max-h-40 overflow-y-auto rounded-md border p-2 space-y-1">
        {isLoading && <p className="text-sm text-muted-foreground p-1">Loading tags…</p>}
        {!isLoading && tags.length === 0 && (
          <p className="text-sm text-muted-foreground p-1">No active tags yet.</p>
        )}
        {tags.map((tag) => (
          <label
            key={tag.slug}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
          >
            <Checkbox
              checked={value.includes(tag.slug)}
              onCheckedChange={() => toggle(tag.slug)}
              disabled={disabled}
              data-testid={`tag-option-${tag.slug}`}
            />
            <span className="truncate">{tag.text}</span>
            <span className="ml-auto font-mono text-xs text-muted-foreground">{tag.slug}</span>
          </label>
        ))}
      </div>

      {selectedButNotOffered.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Also selected:</span>
          {selectedButNotOffered.map((slug) => (
            <Badge key={slug} variant="outline">
              {slug}
            </Badge>
          ))}
        </div>
      )}

      {allowCreate && (
        <div className="flex items-center gap-2">
          <Input
            value={newTagText}
            placeholder="New tag name"
            disabled={disabled || createTag.isPending}
            onChange={(event) => setNewTagText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleCreate();
              }
            }}
            data-testid="new-tag-input"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleCreate()}
            disabled={disabled || createTag.isPending || newTagText.trim() === ''}
            data-testid="create-tag-inline"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
