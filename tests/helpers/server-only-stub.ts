/**
 * Stand-in for the `server-only` package.
 *
 * That package exists to make the Next.js bundler fail if server code is
 * imported into a client component. Inside Vitest there is no bundler and no
 * client, so it resolves to this empty module.
 */
export {};
