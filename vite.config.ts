import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// On GitHub Actions, GITHUB_REPOSITORY is "owner/repo" — use the repo name
// as the base path so assets resolve correctly on a project Pages site
// (https://<owner>.github.io/<repo>/). Locally (and for a custom domain or
// a user/org Pages site named <owner>.github.io), base stays '/'.
const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];
const base = process.env.GITHUB_ACTIONS && repoName && !repoName.endsWith('.github.io') ? `/${repoName}/` : '/';

export default defineConfig({
  base,
  plugins: [react()],
});
