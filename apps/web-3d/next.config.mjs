const roomMode =
  process.env.NEXT_PUBLIC_ROOM ?? (process.env.NODE_ENV === 'development' ? 'fake' : '');

const nextConfig = {
  env: { NEXT_PUBLIC_ROOM: roomMode },
  output: 'export',
  transpilePackages: ['@netverse/ui'],
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(process.env.NODE_ENV === 'development'
    ? {
        rewrites: async () =>
          ['identity', 'notification'].map((service) => ({
            source: `/api/${service}/:path*`,
            destination: `http://127.0.0.1:${process.env.GATEWAY_PORT ?? '58080'}/api/${service}/:path*`,
          })),
      }
    : {}),
};

export default nextConfig;
