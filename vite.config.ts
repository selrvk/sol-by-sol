import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, type Plugin } from 'vite'

// The site's own address, for the link-preview tags in index.html: most
// sites that draw a preview ignore a picture given by a relative path.
// Vercel and Netlify both say where they are deploying to while they build;
// SITE_URL overrides them (e.g. for a custom domain). With none of these,
// as when running locally, the paths stay relative.
function siteUrl(): string {
  const env = process.env
  if (env.SITE_URL) return env.SITE_URL.replace(/\/$/, '')
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (env.URL) return env.URL.replace(/\/$/, '') // Netlify's main address
  return ''
}

const fillSiteUrl: Plugin = {
  name: 'fill-site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl()),
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), fillSiteUrl],
})
