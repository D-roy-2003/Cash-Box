/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['localhost'], // Add your domain here for production
  },
  // Add this new configuration for static file serving
  webpack: (config) => {
    config.module.rules.push({
      test: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
      use: [
        {
          loader: 'file-loader',
          options: {
            publicPath: '/_next/static/uploads',
            outputPath: 'static/uploads',
            name: '[name].[hash].[ext]',
          },
        },
      ],
    });
    return config;
  },
  // Enable static exports for standalone mode if needed
  output: 'standalone',
  // Configure static file serving from /app/Uploads
  async headers() {
    return [
      {
        source: '/Uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
}

export default nextConfig