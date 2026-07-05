import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 수집기 다운로드 API가 런타임에 readFileSync로 읽는 파일들을 서버 번들에 포함
  outputFileTracingIncludes: {
    "/api/collector": ["./collector/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
      },
    ],
  },
};

export default nextConfig;
