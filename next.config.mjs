/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Every page is static, so export plain HTML/JS for simple hosting (Firebase Hosting publishes `out/`, see firebase.json).
  output: 'export',
};
export default nextConfig;
