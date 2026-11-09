/**
 * `cn` also lives here because models reach for `@/lib/cn` (55 imports
 * across the bench's builds by Nov 9, 2026, mostly from small open models)
 * while the kit keeps it in `@/lib/utils`. Same function, one more door.
 */
export { cn } from './utils';
