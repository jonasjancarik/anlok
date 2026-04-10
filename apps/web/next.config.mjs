import { join } from 'path';
import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
    dest: 'public',
    disable: process.env.NODE_ENV === 'development',
    sw: '/src/pwa/sw.js',
    register: true,
    scope: '/',
    runtimeCaching: [
        {
            urlPattern: ({ url }) => {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL;
                return url.origin === appUrl || url.pathname.startsWith(appUrl);
            },
            handler: 'NetworkFirst',
            options: {
                cacheName: 'app-cache',
                expiration: {
                    maxEntries: 32,
                    maxAgeSeconds: 24 * 60 * 60 // 24 hours
                }
            }
        }
    ]
})({
    output: 'export',
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_WEB_APP_TITLE: process.env.NEXT_PUBLIC_WEB_APP_TITLE,
        NEXT_PUBLIC_WEB_APP_SUBTITLE: process.env.NEXT_PUBLIC_WEB_APP_SUBTITLE,
        NEXT_PUBLIC_WEB_APP_PORT: process.env.NEXT_PUBLIC_WEB_APP_PORT,
        NEXT_SENDER_EMAIL: process.env.NEXT_SENDER_EMAIL,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    },
});

export default nextConfig;
