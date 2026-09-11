/**
 * The sign-in email's link lands at relationalbuilder.org/auth/confirm with a
 * token *hash* in the query — nothing is verified until a person presses the
 * button on that page (see ConfirmSignInPage), so inbox link scanners can't
 * spend the token. The Supabase magic-link template builds this address:
 *   {{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=magiclink
 */
export const CONFIRM_PATH = '/auth/confirm';

export function isConfirmPath(): boolean {
  return window.location.pathname.replace(/\/+$/, '').toLowerCase() === CONFIRM_PATH;
}

export function readConfirmToken(): string | null {
  if (!isConfirmPath()) return null;
  return new URLSearchParams(window.location.search).get('token_hash');
}
