/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every page is static, so export plain HTML/JS for simple hosting (Netlify publishes `out/`).
  output: 'export',
};
export default nextConfig;
