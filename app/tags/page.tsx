import { Suspense } from 'react';

import { TagsPageClient } from '../components/tags-page-client';
import { ListLoadingFallback } from '../loading';

/**
 * Tags page.
 *
 * Tags are their own screen rather than a panel on the templates page: both
 * lists filter on `status`, and sharing one query string would mean prefixing
 * one of them (`useFilteredTags({ paramPrefix: 'tag' })`) for no gain in a
 * dashboard where the two are managed separately.
 */
export default function TagsPage() {
  return (
    <Suspense fallback={<ListLoadingFallback />}>
      <TagsPageClient />
    </Suspense>
  );
}
