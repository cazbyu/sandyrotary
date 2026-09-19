export function joinHref(): { href: string; external: boolean } {
  const url = import.meta.env.VITE_JOIN_URL;
  if (url) return { href: url, external: true };
  return { href: '/join', external: false };
}

export function referHref(): { href: string; external: boolean } {
  const url = import.meta.env.VITE_REFER_URL;
  if (url) return { href: url, external: true };
  return { href: '/refer-public', external: false };
}
