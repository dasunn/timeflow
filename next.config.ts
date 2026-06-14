import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure Prisma's query-engine binary is traced into the serverless function
  // bundle on Netlify (it's loaded dynamically, so @vercel/nft can miss it).
  outputFileTracingIncludes: {
    "/": ["node_modules/.prisma/client/*.node"],
    "/*": ["node_modules/.prisma/client/*.node"],
  },
};

export default nextConfig;
