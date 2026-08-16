# Inoreader Colorful Listview

Inoreaderの記事リストを、フィードソースごとに自動で色分けするユーザースクリプト。

## 特徴

- フィードタイトルからハッシュ値を計算し、ソースごとに一貫した背景色を割り当てる
- 背景色を上書きせず半透明の色を重ねる方式のため、Aqua / Light / Sepia / Dark の全テーマで文字のコントラストを損なわない
- Inoreader側の既読・選択中のハイライトもそのまま機能する
- CSSカスタムプロパティで色を渡すため、フィード数が増えてもスタイルシートが肥大化しない
- `requestAnimationFrame` でDOM監視を間引き、パフォーマンスへの影響を抑える

## インストール

[Violentmonkey](https://violentmonkey.github.io/) や [Tampermonkey](https://www.tampermonkey.net/) などのユーザースクリプトマネージャーを導入した上で、`inoreader-colorful-listview.user.js` を読み込む。

## 設定

スクリプト冒頭の定数で色味を調整できる。

| 定数 | 既定値 | 内容 |
| --- | --- | --- |
| `TINT` | `0.18` | 通常時の着色の濃さ (0-1) |
| `TINT_HOVER` | `0.32` | ホバー時の着色の濃さ (0-1) |
| `SAT_MIN` | `35` | 彩度の下限 (%) |
| `SAT_RANGE` | `40` | 彩度の振れ幅 (%) |

## 由来

[yamalight/feedly-colorful-list-view](https://github.com/yamalight/feedly-colorful-list-view) の「フィードソースをハッシュから色分けする」というアイデアにインスパイアされた、Inoreader向けの独立した再実装。対象サイトが異なるため、DOM構造・ハッシュアルゴリズム・スタイル適用方式はいずれも別実装。

## License

MIT
