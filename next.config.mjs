/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    turbo: {
      rules: {}, // optional, can remove if not used
    },
  },
};

export default nextConfig;
