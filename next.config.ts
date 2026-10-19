import type { NextConfig } from "next"

// Production is a static export served by the relayer from out/. Routing stays in the URL hash,
// which browsers never send to a server, so nobody can see which road a visitor opened.
const dev = process.env.NODE_ENV !== "production"

const config: NextConfig = dev
  ? {
      async rewrites() {
        return [
          { source: "/api/:path*", destination: "http://localhost:8790/api/:path*" },
          { source: "/photos/:path*", destination: "http://localhost:8790/photos/:path*" },
        ]
      },
      devIndicators: false,
    }
  : { output: "export", images: { unoptimized: true } }

export default config
