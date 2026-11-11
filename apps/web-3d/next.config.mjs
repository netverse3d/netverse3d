const roomMode =
  process.env.NEXT_PUBLIC_ROOM ?? (process.env.NODE_ENV === 'development' ? 'fake' : '');

const nextConfig = {
  env: { NEXT_PUBLIC_ROOM: roomMode },
  output: 'export',
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
