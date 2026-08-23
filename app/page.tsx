import { Suspense } from 'react';

import { TemplatesPageClient } from './components/templates-page-client';
import { ListLoadingFallback } from './loading';

/**
 * Templates page.
 *
 * There is nothing to fetch here. Filters, pagination and the list query all
 * live in `vintasend-templates-management-dashboard-core`'s hooks, which read
 * the query string directly, so the page is only a Suspense boundary around the
 * client component. Next requires that boundary of anything calling
 * `useSearchParams` — which the core's Next router adapter does — and without it
 * the whole route opts out of static rendering.
 */
export default function TemplatesPage() {
  return (
    <Suspense fallback={<ListLoadingFallback />}>
      <TemplatesPageClient />
    </Suspense>
  );
}
