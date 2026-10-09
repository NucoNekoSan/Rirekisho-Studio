const configuredBase = import.meta.env.BASE_URL;

export const siteBasePath = configuredBase === './' ? '/' : configuredBase;

export function sitePath(path: string): string {
  return `${siteBasePath}${path.replace(/^\//, '')}`;
}
