/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@ai-code-guardian/core', '@ai-code-guardian/supabase'],
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
