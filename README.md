# 💊 けんこう日記

毎日の血圧・お薬を記録する健康管理アプリです。

## 機能
- お薬チェック（朝・昼・夜）
- 血圧・脈拍の記録（▲▼ボタンで簡単入力）
- 血圧推移グラフ（1週間〜3ヶ月）
- 記録履歴の一覧表示
- データはブラウザに自動保存（localStorage）

## ローカルで動かす

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173/health-tracker/ を開きます。

## GitHub Pages へのデプロイ

このリポジトリを GitHub に push するだけで自動デプロイされます（GitHub Actions）。

### 初回セットアップ

1. GitHub でリポジトリ Settings → Pages を開く
2. Source を **GitHub Actions** に変更
3. main ブランチに push すると自動でビルド・デプロイ

公開URL: `https://<あなたのユーザー名>.github.io/health-tracker/`
