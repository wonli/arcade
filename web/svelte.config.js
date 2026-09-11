import adapter from '@sveltejs/adapter-static'

const config = {
  kit: {
    adapter: adapter({
      pages: '../internal/frontend/dist',
      assets: '../internal/frontend/dist',
      fallback: '200.html',
      strict: false,
    }),
  },
}

export default config
