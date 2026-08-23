import { Skeleton } from '@/components/ui/skeleton';

/**
 * Loading skeleton for a list page.
 *
 * Shown while the route streams and hydrates. It stands in for both lists, so
 * the column count is the templates table's — the tags one is narrower and
 * simply settles into fewer columns once it renders.
 */
export function ListLoadingFallback() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-5 w-80" />
        </div>

        <div className="flex flex-col gap-4 p-4 border border-input rounded-lg bg-background sm:flex-row sm:items-end sm:gap-2">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="w-full sm:w-auto space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-40" />
          </div>
          <div className="w-full sm:w-auto space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="border-b bg-muted">
              <tr>
                {Array.from({ length: 7 }).map((_, i) => (
                  <th key={`skeleton-head-${i}`} className="px-4 py-3 text-left">
                    <Skeleton className="h-4 w-16" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 10 }).map((_, row) => (
                <tr key={`skeleton-row-${row}`} className="border-b">
                  {Array.from({ length: 7 }).map((_, cell) => (
                    <td key={`skeleton-cell-${row}-${cell}`} className="px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-4 mt-6">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-10 w-10" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>
      </div>
    </main>
  );
}

export default ListLoadingFallback;
