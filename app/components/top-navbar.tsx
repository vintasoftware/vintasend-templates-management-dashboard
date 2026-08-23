'use client';

import { FileText, LogOut, Tags } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth/auth-context';
import { cn } from '@/lib/utils';

/**
 * Top navigation bar with the two sections and the user menu.
 *
 * Templates and tags are separate screens rather than tabs on one, because both
 * keep their filters in the query string and a shared URL would need a prefix
 * on one of them to stop the two `status` filters colliding.
 */
const SECTIONS = [
  { href: '/', label: 'Templates', icon: FileText },
  { href: '/tags', label: 'Tags', icon: Tags },
] as const;

export function TopNavbar() {
  const { user, signOutUrl } = useAuth();
  const pathname = usePathname();

  if (!user) {
    return null;
  }

  const displayName = user.name || user.email || 'User';

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <Link href="/" className="font-bold text-lg whitespace-nowrap">
            VintaSend Templates
          </Link>

          <div className="flex items-center gap-1">
            {SECTIONS.map((section) => {
              const isActive =
                section.href === '/' ? pathname === '/' : pathname.startsWith(section.href);

              return (
                <Button
                  key={section.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(isActive && 'bg-accent text-accent-foreground')}
                >
                  <Link href={section.href} aria-current={isActive ? 'page' : undefined}>
                    <section.icon className="h-4 w-4" />
                    {section.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 rounded-full" title={displayName}>
              {user.imageUrl && (
                <Image
                  src={user.imageUrl}
                  alt={user.name || 'User avatar'}
                  className="w-8 h-8 rounded-full"
                  width={32}
                  height={32}
                />
              )}
              <span className="hidden sm:inline text-sm">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-1">
                <p className="font-semibold">{user.name || 'User'}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <DropdownMenuItem asChild>
              <a
                href={signOutUrl}
                className="cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </a>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
