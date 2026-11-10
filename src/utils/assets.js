export function getAssetUrl(path) {
  if (!path) return '';
  if (/^(?:https?:|data:)/i.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  if (base !== '/' && path.startsWith(base)) {
    return path;
  }
  const clean = path.replace(/^\/+/, '');
  return base.endsWith('/') ? `${base}${clean}` : `${base}/${clean}`;
}
