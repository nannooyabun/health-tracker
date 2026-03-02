import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages にデプロイする場合、リポジトリ名をbaseに設定
// 例: https://<username>.github.io/health-tracker/
// ※ リポジトリ名を変えた場合はここも変更してください
export default defineConfig({
  plugins: [react()],
  base: '/health-tracker/',
})
