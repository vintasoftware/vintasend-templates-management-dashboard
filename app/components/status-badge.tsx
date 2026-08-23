'use client';

import type { TagStatus, TemplateStatus } from 'vintasend-templates-management-dashboard-core';

import { Badge } from '@/components/ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * Lifecycle status to badge colour.
 *
 * `active` is the one status that says "this is what gets sent", so it is the
 * only one rendered in the primary colour; the rest are degrees of inert.
 */
const templateStatusVariant: Record<TemplateStatus, BadgeVariant> = {
  draft: 'outline',
  active: 'default',
  inactive: 'secondary',
  archived: 'secondary',
};

const tagStatusVariant: Record<TagStatus, BadgeVariant> = {
  active: 'default',
  archived: 'secondary',
};

export function TemplateStatusBadge({ status }: { status: TemplateStatus }) {
  return (
    <Badge variant={templateStatusVariant[status]} data-testid={`template-status-${status}`}>
      {status}
    </Badge>
  );
}

export function TagStatusBadge({ status }: { status: TagStatus }) {
  return (
    <Badge variant={tagStatusVariant[status]} data-testid={`tag-status-${status}`}>
      {status}
    </Badge>
  );
}
