/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@poruchka/shared"],
  async redirects() {
    // Old IA: /suppliers + /items merged into /catalog; /schedules renamed /orders.
    return [
      { source: "/schedules", destination: "/orders", permanent: false },
      { source: "/suppliers", destination: "/catalog", permanent: false },
      { source: "/items", destination: "/catalog", permanent: false },
      { source: "/profile", destination: "/settings", permanent: false },
    ];
  },
};

export default nextConfig;
