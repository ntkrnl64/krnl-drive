import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'KRNL Drive',
  description: 'Self-hosted file storage and sharing on Cloudflare Workers',
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Setup', link: '/setup' },
      { text: 'API', link: '/api' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Setup & Deployment', link: '/setup' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Features Guide', link: '/features' },
          { text: 'API Reference', link: '/api' },
          { text: 'Architecture', link: '/architecture' },
        ],
      },
    ],

    socialLinks: [],

    footer: {
      message: 'KRNL Drive',
    },
  },
})
