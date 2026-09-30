// ============================================================
// 基本設定・共通関数
// ============================================================

// querySelector の省略形
const $ = (selector) => document.querySelector(selector);

// データ
let songs = [];
let groups = [];
let visible = [];

// 一覧表示数
let shown = 0;
const pageSize = 24;


// 日付表示
// 例：2026/09/29 → 2026.09.29
const fmt = (date) =>
  String(date || "").replaceAll("/", ".");


// 検索用の文字列を正規化
const norm = (text) =>
  String(text || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");


// HTML要素を作る共通関数
function el(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text != null) {
    element.textContent = text;
  }

  return element;
}


// ============================================================
// 楽曲一覧の検索・並び替え
// ============================================================

function render() {
  const query = norm($("#query").value);
  const minCount = Number($("#minCount").value);
  const sort = $("#sort").value;


  // 検索条件・歌唱回数で絞り込み
  visible = groups.filter((group) => {
    const searchableText = norm(
      group.title + " " + group.artist
    );

    return (
      group.items.length >= minCount &&
      searchableText.includes(query)
    );
  });


  // 並び替え
  visible.sort((a, b) => {

    // 歌唱回数順
    if (sort === "count") {
      return (
        b.items.length - a.items.length ||
        b.date.localeCompare(a.date)
      );
    }

    // 曲名順
    if (sort === "title") {
      return a.title.localeCompare(b.title, "ja");
    }

    // 古い歌唱順
    if (sort === "old") {
      return a.date.localeCompare(b.date);
    }

    // 新しい歌唱順
    return b.date.localeCompare(a.date);
  });


  // 検索結果件数
  $("#resultCount").textContent =
    `${visible.length.toLocaleString("ja-JP")} 曲`;


  // 検索結果なし表示
  $("#empty").hidden = visible.length !== 0;


  // 一覧をリセット
  shown = 0;
  $("#list").replaceChildren();


  // 最初の24曲を表示
  more();
}


// ============================================================
// 楽曲カードを追加表示
// ============================================================

function more() {
  const fragment = document.createDocumentFragment();

  const displaySongs =
    visible.slice(shown, shown + pageSize);


  for (const group of displaySongs) {

    // -------------------------
    // カード本体
    // -------------------------

    const card = el("article", "card");

    const head = el("div", "card-head");
    const meta = el("div");


    // 曲名・アーティスト
    meta.append(
      el("h3", "", group.title),
      el("p", "artist", group.artist)
    );


    // 歌唱回数
    head.append(
      meta,
      el(
        "span",
        "badge",
        `${group.items.length}回歌唱`
      )
    );

    card.append(head);


    // -------------------------
    // 最新の歌唱
    // -------------------------

    const latest = group.items[0];

    const line = el("div", "latest");


    // 日付・タイムスタンプ
    line.append(
      el(
        "span",
        "",
        `${fmt(latest.date)}　${latest.time || ""}`
      )
    );


    // 再生リンク
    const play = el("a", "play", "▶ 再生");

    play.href = latest.url;
    play.target = "_blank";
    play.rel = "noopener noreferrer";

    play.setAttribute(
      "aria-label",
      `${group.title} ${fmt(latest.date)} ${latest.time || ""} から再生`
    );

    line.append(play);

    card.append(line);


    // 配信タイトル
    if (latest.streamTitle) {
      card.append(
        el(
          "p",
          "stream-title",
          latest.streamTitle
        )
      );
    }


    // -------------------------
    // 過去の歌唱履歴
    // -------------------------

    if (group.items.length > 1) {

      const details = el(
        "details",
        "history"
      );

      const summary = el(
        "summary",
        "",
        `すべての歌唱履歴（${group.items.length}件）`
      );

      const list = el("ul");


      for (const item of group.items) {

        const itemElement = el("li");

        const link = el(
          "a",
          "",
          `${item.time || "再生"} ▶`
        );

        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";


        // 日付・配信タイトル
        const info = el(
          "span",
          "history-info"
        );

        info.append(
          el(
            "span",
            "",
            fmt(item.date)
          )
        );


        if (item.streamTitle) {
          info.append(
            el(
              "small",
              "",
              item.streamTitle
            )
          );
        }


        itemElement.append(
          info,
          link
        );

        list.append(itemElement);
      }


      details.append(
        summary,
        list
      );

      card.append(details);
    }


    fragment.append(card);
  }


  // 一覧へ追加
  $("#list").append(fragment);


  // 表示済み件数を更新
  shown += pageSize;


  // 全件表示したら
  // 「もっと見る」を非表示
  $("#more").hidden =
    shown >= visible.length;
}


// ============================================================
// Googleスプレッドシート
// ============================================================

const SHEET_ID =
  "127P3KxUfj_MELT37ewvMRAgp4dByKz6JLiVdMuQTwx8";


// Googleスプレッドシートから最新データを取得
function liveSongs() {

  return new Promise((resolve, reject) => {

    const callback = "suiminSheetData";

    const script =
      document.createElement("script");

    let done = false;


    // -------------------------
    // 通信終了処理
    // -------------------------

    const finish = (error, data) => {

      // 二重実行防止
      if (done) {
        return;
      }

      done = true;


      clearTimeout(timer);

      delete window[callback];

      script.remove();


      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    };


    // -------------------------
    // タイムアウト
    // -------------------------

    const timer = setTimeout(
      () => finish(Error("timeout")),
      20000
    );


    // -------------------------
    // Googleからのレスポンス
    // -------------------------

    window[callback] = (response) => {

      try {

        if (response.status !== "ok") {
          throw Error("sheet error");
        }


        // セルデータ取得
        const cell = (row, index) =>
          row.c?.[index]?.f ??
          row.c?.[index]?.v ??
          "";


        // スプレッドシート → JSオブジェクト
        const items =
          response.table.rows

            .map((row) => ({
              streamTitle:
                String(cell(row, 0)),

              date:
                String(cell(row, 1)),

              title:
                String(cell(row, 2)),

              artist:
                String(cell(row, 3)),

              time:
                String(cell(row, 4)),

              stream:
                String(cell(row, 5)),

              url:
                String(cell(row, 6))
            }))


            // 曲名・アーティスト・
            // YouTube URLがあるデータのみ使用
            .filter((song) =>
              song.title &&
              song.artist &&
              /^https:\/\/(www\.)?youtube\.com\//
                .test(song.url)
            );


        if (!items.length) {
          throw Error("empty sheet");
        }


        finish(null, items);

      } catch (error) {

        finish(error);
      }
    };


    // 通信エラー
    script.onerror = () =>
      finish(Error("network"));


    // -------------------------
    // Google Visualization API
    // -------------------------

    const query =
      "select B,D,E,F,G,I,N where E is not null";


    script.src =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
      `?sheet=${encodeURIComponent("リスト")}` +
      `&tqx=${encodeURIComponent(
        "out:json;responseHandler:" + callback
      )}` +
      `&tq=${encodeURIComponent(query)}` +
      `&_=${Date.now()}`;


    document.head.append(script);
  });
}


// ============================================================
// 最新歌唱へのリンク
// ============================================================

function latestLink(group, label) {

  const link = el(
    "a",
    "",
    label
  );


  link.href =
    group.items[0].url;

  link.target =
    "_blank";

  link.rel =
    "noopener noreferrer";


  link.setAttribute(
    "aria-label",
    `${group.title} の最新の歌唱を再生`
  );


  return link;
}


// ============================================================
// TOP5・おすすめ楽曲
// ============================================================

function renderHighlights() {

  // 歌唱回数TOP5
  const top =
    [...groups]

      .sort((a, b) =>
        b.items.length - a.items.length ||

        b.date.localeCompare(a.date) ||

        a.title.localeCompare(
          b.title,
          "ja"
        )
      )

      .slice(0, 5);


  const list =
    $("#topFive");


  list.replaceChildren();


  // TOP5を表示
  for (const group of top) {

    const item =
      el("li");

    const info =
      el("div", "top-song");


    info.append(
      latestLink(
        group,
        group.title
      ),

      el(
        "small",
        "",
        group.artist
      )
    );


    item.append(
      info,

      el(
        "span",
        "top-count",
        `${group.items.length}回`
      )
    );


    list.append(item);
  }


  // ランダム楽曲表示
  pickSong();
}


// ============================================================
// ランダムおすすめ楽曲
// ============================================================

let previousPick = -1;


function pickSong() {

  if (!groups.length) {
    return;
  }


  // ランダムに選択
  let index =
    Math.floor(
      Math.random() * groups.length
    );


  // 前回と同じ曲なら
  // 次の曲へずらす
  if (
    groups.length > 1 &&
    index === previousPick
  ) {

    index =
      (index + 1) % groups.length;
  }


  previousPick = index;


  const group =
    groups[index];

  const box =
    $("#randomSong");


  box.replaceChildren();


  box.append(

    // 曲名
    el(
      "h3",
      "",
      group.title
    ),

    // アーティスト
    el(
      "p",
      "",
      group.artist
    ),

    // 歌唱回数・最新日
    el(
      "p",
      "pick-note",
      `${group.items.length}回歌唱 · 最新 ${fmt(group.date)}`
    ),

    // 最新歌唱へのリンク
    latestLink(
      group,
      `${group.items[0].time || "冒頭"} から聴く ▶`
    )
  );
}


// ============================================================
// 楽曲データを画面表示用に整理
// ============================================================

function showSongs(data) {

  songs = data;


  // -------------------------
  // 配信タイトルを整理
  // -------------------------

  const streamTitles =
    new Map();


  for (const song of songs) {

    if (
      song.stream &&
      song.streamTitle
    ) {

      streamTitles.set(
        song.stream,
        song.streamTitle.trim()
      );
    }
  }


  for (const song of songs) {

    song.streamTitle =
      streamTitles.get(song.stream) ||
      song.streamTitle?.trim() ||
      "";
  }


  // -------------------------
  // 同じ曲をまとめる
  // -------------------------

  const map =
    new Map();


  for (const song of songs) {

    const key =
      norm(song.title) +
      "|" +
      norm(song.artist);


    if (!map.has(key)) {

      map.set(
        key,
        {
          title: song.title,
          artist: song.artist,
          items: [],
          date: song.date
        }
      );
    }


    map.get(key)
      .items
      .push(song);
  }


  groups =
    [...map.values()];


  // -------------------------
  // 各曲の歌唱履歴を
  // 新しい順に並べる
  // -------------------------

  for (const group of groups) {

    group.items.sort(
      (a, b) =>

        String(b.date)
          .localeCompare(
            String(a.date)
          )

        ||

        String(b.time)
          .localeCompare(
            String(a.time)
          )
    );


    // 最新歌唱日
    group.date =
      group.items[0].date;
  }


  // -------------------------
  // 総歌唱数
  // -------------------------

  $("#songCount").textContent =
    songs.length.toLocaleString(
      "ja-JP"
    );


  // -------------------------
  // 記録期間
  // -------------------------

  const dates =
    songs
      .map((song) => song.date)
      .filter(Boolean)
      .sort();


  $("#rangeText").textContent =
    `${fmt(dates[0])} 〜 ${fmt(dates.at(-1))}`;


  // TOP5・おすすめ
  renderHighlights();


  // 楽曲一覧
  render();
}


// ============================================================
// 初期データ読み込み
// ============================================================

async function start() {

  try {

    // -------------------------
    // スプレッドシートから取得
    // -------------------------

    showSongs(
      await liveSongs()
    );


    $("#dataStatus").textContent =
      "元のスプレッドシートから読み込みました。" +
      "シートの変更はページを開き直すと反映されます。";


  } catch (error) {

    try {

      // -------------------------
      // スプレッドシート取得失敗
      // → songs.jsonを使用
      // -------------------------

      const response =
        await fetch("songs.json");


      if (!response.ok) {
        throw Error();
      }


      showSongs(
        await response.json()
      );


      $("#dataStatus").textContent =
        "シートに接続できなかったため、" +
        "保存済みのデータを表示しています。";


    } catch (error) {

      // -------------------------
      // JSONも読み込めなかった場合
      // -------------------------

      $("#empty").hidden =
        false;


      $("#empty").textContent =
        "楽曲データを読み込めませんでした。" +
        "ページを再読み込みしてください。";


      $("#dataStatus").textContent =
        "楽曲データを読み込めませんでした。";
    }
  }
}


// ============================================================
// イベント設定
// ============================================================

// 検索
$("#query")
  .addEventListener(
    "input",
    render
  );


// 並び順
$("#sort")
  .addEventListener(
    "change",
    render
  );


// 歌唱回数
$("#minCount")
  .addEventListener(
    "change",
    render
  );


// もっと見る
$("#more")
  .addEventListener(
    "click",
    more
  );


// おすすめ楽曲を再抽選
$("#shuffle")
  .addEventListener(
    "click",
    pickSong
  );


// ============================================================
// サイト起動
// ============================================================

start();
