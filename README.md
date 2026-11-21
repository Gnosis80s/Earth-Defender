# Earth Defender

An arcade horizontal space shooter built with React, TypeScript, Tailwind CSS, and Three.js (WebGL), featuring an interactive C++20 / WebAssembly (WASM) engine architecture inspector.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

## Production Build

```bash
npm run build
npm run preview
```

## Deploying to GitHub Pages

1. Push this repository to GitHub on the `main` branch.
2. In your GitHub repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, select **GitHub Actions**.
4. The included `.github/workflows/deploy.yml` workflow will automatically build and publish the game.
