/** @type {import('next').NextConfig} */
const nextConfig = {
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push("ffmpeg-static");
        }

        return config;
    },
};

export default nextConfig;