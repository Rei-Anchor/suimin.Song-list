# suimin. 歌った曲リスト

GitHub Pages 用の静的サイトです。`index.html`、`style.css`、`script.js`、`songs.json` をリポジトリのルートに置いてください。

## 公開

GitHub で新しいリポジトリを作成し、このフォルダのファイルをアップロードします。Settings → Pages → Build and deployment で Deploy from a branch を選び、main ブランチの /(root) を指定します。

## 楽曲の更新

サイトはページ表示時に元の Google スプレッドシートの「リスト」タブを読みます。シートに追加したデータはページを再読み込みすると反映されます。読み込みに失敗した場合のみ `songs.json` の保存済みデータを表示します。`songs.json` は 2026-09-30 時点の控えです。

`script.js` の SHEET_ID が元シートを指定しています。配信タイトルは同じアーカイブ URL の行に補完して表示します。
