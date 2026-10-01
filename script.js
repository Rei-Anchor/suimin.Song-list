// ========================================
// 基本設定・共通関数
// ========================================

const $ = (selector) => document.querySelector(selector);

let songs = [];
let groups = [];
let visible = [];
let shown = 0;

const pageSize = 24;
const SHEET_ID = '127P3KxUfj_MELT37ewvMRAgp4dByKz6JLiVdMuQTwx8';

const fmt = (date) =>
  String(date || '').replaceAll('/', '.');

const norm = (text) =>
  String(text || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/\s+/g, '');

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


// ========================================
// 楽曲一覧の表示
// ========================================

function render() {
  const query = norm($('#query').value);
  const minCount = Number($('#minCount').value);
  const sort = $('#sort').value;

  // 検索・歌唱回数で絞り込み
  visible = groups.filter((group) => {
    const searchableText = norm(
      `${group.title} ${group.artist}`
    );

    return (
      group.items.length >= minCount &&
      searchableText.includes(query)
    );
  });

  // 並び替え
  visible.sort((a, b) => {
    if (sort === 'count') {
      return (
        b.items.length - a.items.length ||
        b.date.localeCompare(a.date)
      );
    }

    if (sort === 'title') {
      return a.title.localeCompare(b.title, 'ja');
    }

    if (sort === 'old') {
      return a.date.localeCompare(b.date);
    }

    // デフォルト：新しい順
    return b.date.localeCompare(a.date);
  });

  // 検索結果件数
  $('#resultCount').textContent =
    `${visible.length.toLocaleString('ja-JP')} 曲`;

  $('#empty').hidden = visible.length !== 0;

  // 一覧をリセット
  shown = 0;
  $('#list').replaceChildren();

  more();
}


// ========================================
// 楽曲カードを追加表示
// ========================================

function more() {
  const fragment = document.createDocumentFragment();

  const displayGroups =
    visible.slice(shown, shown + pageSize);

  for (const group of displayGroups) {
    const card = el('article', 'card');

    // ------------------------------------
    // カード上部
    // ------------------------------------

    const head = el('div', 'card-head');
    const meta = el('div');

    meta.append(
      el('h3', '', group.title),
      el('p', 'artist', group.artist)
    );

    head.append(
      meta,
      el(
        'span',
        'badge',
        `${group.items.length}回歌唱`
      )
    );

    card.append(head);

    // ------------------------------------
    // 最新の歌唱
    // ------------------------------------

    const latest = group.items[0];
    const latestLine = el('div', 'latest');

    latestLine.append(
      el(
        'span',
        '',
        `${fmt(latest.date)}　${latest.time || ''}`
      )
    );

    const play = el('a', 'play', '▶ 再生');

    play.href = latest.url;
    play.target = '_blank';
    play.rel = 'noopener noreferrer';

    play.setAttribute(
      'aria-label',
      `${group.title} ${fmt(latest.date)} ${
        latest.time || ''
      } から再生`
    );

    latestLine.append(play);
    card.append(latestLine);

    // 配信タイトル
    if (latest.streamTitle) {
      card.append(
        el(
          'p',
          'stream-title',
          latest.streamTitle
        )
      );
    }

    // ------------------------------------
    // 過去の歌唱履歴
    // ------------------------------------

    if (group.items.length > 1) {
      const details = el('details', 'history');

      const summary = el(
        'summary',
        '',
        `すべての歌唱履歴（${group.items.length}件）`
      );

      const list = el('ul');

      for (const item of group.items) {
        const listItem = el('li');

        const link = el(
          'a',
          '',
          `${item.time || '再生'} ▶`
        );

        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        const info = el('span', 'history-info');

        info.append(
          el('span', '', fmt(item.date))
        );

        if (item.streamTitle) {
          info.append(
            el(
              'small',
              '',
              item.streamTitle
            )
          );
        }

        listItem.append(info, link);
        list.append(listItem);
      }

      details.append(summary, list);
      card.append(details);
    }

    fragment.append(card);
  }

  $('#list').append(fragment);

  shown += pageSize;

  $('#more').hidden =
    shown >= visible.length;
}


// ========================================
// Googleスプレッドシートから取得
// ========================================

function liveSongs() {
  return new Promise((resolve, reject) => {
    const callback = 'suiminSheetData';
    const script = document.createElement('script');

    let done = false;

    const finish = (error, data) => {
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

    // 20秒でタイムアウト
    const timer = setTimeout(() => {
      finish(Error('timeout'));
    }, 20000);

    // Google Sheetsからデータ取得後に実行
    window[callback] = (response) => {
      try {
        if (response.status !== 'ok') {
          throw Error('sheet error');
        }

        const cell = (row, index) =>
          row.c?.[index]?.f ??
          row.c?.[index]?.v ??
          '';

        const items = response.table.rows
          .map((row) => ({
            streamTitle: String(cell(row, 0)),
            date: String(cell(row, 1)),
            title: String(cell(row, 2)),
            artist: String(cell(row, 3)),
            time: String(cell(row, 4)),
            stream: String(cell(row, 5)),
            url: String(cell(row, 6)),
          }))
          .filter((song) => {
            return (
              song.title &&
              song.artist &&
              /^https:\/\/(www\.)?youtube\.com\//.test(
                song.url
              )
            );
          });

        if (!items.length) {
          throw Error('empty sheet');
        }

        finish(null, items);
      } catch (error) {
        finish(error);
      }
    };

    // 通信エラー
    script.onerror = () => {
      finish(Error('network'));
    };

    const query =
      'select B,D,E,F,G,I,N where E is not null';

    const sheetName = 'リスト';

    script.src =
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
      `?sheet=${encodeURIComponent(sheetName)}` +
      `&tqx=${encodeURIComponent(
        'out:json;responseHandler:' + callback
      )}` +
      `&tq=${encodeURIComponent(query)}` +
      `&_=${Date.now()}`;

    document.head.append(script);
  });
}


// ========================================
// 最新歌唱へのリンク作成
// ========================================

function latestLink(group, label) {
  const link = el('a', '', label);

  link.href = group.items[0].url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';

  link.setAttribute(
    'aria-label',
    `${group.title} の最新の歌唱を再生`
  );

  return link;
}


// ========================================
// 歌唱回数TOP5
// ========================================

function renderHighlights() {
  const top = [...groups]
    .sort((a, b) => {
      return (
        b.items.length - a.items.length ||
        b.date.localeCompare(a.date) ||
        a.title.localeCompare(b.title, 'ja')
      );
    })
    .slice(0, 5);

  const list = $('#topFive');

  list.replaceChildren();

  for (const group of top) {
    const listItem = el('li');

    const info = el('div', 'top-song');

    info.append(
      latestLink(group, group.title),
      el('small', '', group.artist)
    );

    listItem.append(
      info,
      el(
        'span',
        'top-count',
        `${group.items.length}回`
      )
    );

    list.append(listItem);
  }

  pickSong();
}


// ========================================
// ランダムで1曲表示
// ========================================

let previousPick = -1;

function pickSong() {
  if (!groups.length) {
    return;
  }

  let index =
    Math.floor(Math.random() * groups.length);

  // 直前と同じ曲を避ける
  if (
    groups.length > 1 &&
    index === previousPick
  ) {
    index = (index + 1) % groups.length;
  }

  previousPick = index;

  const group = groups[index];
  const box = $('#randomSong');

  box.replaceChildren();

  box.append(
    el('h3', '', group.title),

    el(
      'p',
      '',
      group.artist
    ),

    el(
      'p',
      'pick-note',
      `${group.items.length}回歌唱 · 最新 ${fmt(
        group.date
      )}`
    ),

    latestLink(
      group,
      `${group.items[0].time || '冒頭'} から聴く ▶`
    )
  );
}


// ========================================
// 取得した楽曲データを整理
// ========================================

function showSongs(data) {
  songs = data;

  // ------------------------------------
  // 配信タイトルを補完
  // ------------------------------------

  const streamTitles = new Map();

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
      '';
  }

  // ------------------------------------
  // 同じ楽曲をまとめる
  // ------------------------------------

  const map = new Map();

  for (const song of songs) {
    const key =
      norm(song.title) +
      '|' +
      norm(song.artist);

    if (!map.has(key)) {
      map.set(key, {
        title: song.title,
        artist: song.artist,
        items: [],
        date: song.date,
      });
    }

    map.get(key).items.push(song);
  }

  groups = [...map.values()];

  // ------------------------------------
  // 各楽曲の歌唱履歴を新しい順に
  // ------------------------------------

  for (const group of groups) {
    group.items.sort((a, b) => {
      return (
        String(b.date).localeCompare(
          String(a.date)
        ) ||
        String(b.time).localeCompare(
          String(a.time)
        )
      );
    });

    group.date =
      group.items[0].date;
  }

  // ------------------------------------
  // 統計表示
  // ------------------------------------

  $('#songCount').textContent =
    songs.length.toLocaleString('ja-JP');

  const dates = songs
    .map((song) => song.date)
    .filter(Boolean)
    .sort();

  $('#rangeText').textContent =
    `${fmt(dates[0])} 〜 ${fmt(dates.at(-1))}`;

  renderHighlights();
  render();
}


// ========================================
// 初期データ読み込み
// ========================================

async function start() {
  try {
    // Googleスプレッドシートを優先
    const liveData = await liveSongs();

    showSongs(liveData);

    $('#dataStatus').textContent =
      '元のスプレッドシートから読み込みました。' +
      'シートの変更はページを開き直すと反映されます。';

  } catch (error) {

    // ------------------------------------
    // スプレッドシート取得失敗
    // → songs.json を使用
    // ------------------------------------

    try {
      const response =
        await fetch('songs.json');

      if (!response.ok) {
        throw Error();
      }

      const savedData =
        await response.json();

      showSongs(savedData);

      $('#dataStatus').textContent =
        'シートに接続できなかったため、' +
        '保存済みのデータを表示しています。';

    } catch (error) {

      // ----------------------------------
      // 両方失敗
      // ----------------------------------

      $('#empty').hidden = false;

      $('#empty').textContent =
        '楽曲データを読み込めませんでした。' +
        'ページを再読み込みしてください。';

      $('#dataStatus').textContent =
        '楽曲データを読み込めませんでした。';
    }
  }
}


// ========================================
// イベント設定
// ========================================

// 検索
$('#query').addEventListener(
  'input',
  render
);

// 並び替え
$('#sort').addEventListener(
  'change',
  render
);

// 最低歌唱回数
$('#minCount').addEventListener(
  'change',
  render
);

// 「もっと見る」
$('#more').addEventListener(
  'click',
  more
);

// ランダム選曲
$('#shuffle').addEventListener(
  'click',
  pickSong
);


// ========================================
// 起動
// ========================================

start();



/* ============================================================
   配信スケジュール
   ============================================================ */

const SCHEDULE_SHEET = "スケジュール";


/*
 * 今日から7日分のスケジュールを取得
 */
function loadSchedule() {

  const query =
    "select A, B, C where A is not null";

  const url =
    "https://docs.google.com/spreadsheets/d/" +
    SHEET_ID +
    "/gviz/tq" +
    "?sheet=" +
    encodeURIComponent(SCHEDULE_SHEET) +
    "&tqx=out:json" +
    "&tq=" +
    encodeURIComponent(query);

  fetch(url)

    .then(response => response.text())

    .then(text => {

      /*
       * Google Visualization APIの
       * JSON部分だけ取り出す
       */
      const jsonText =
        text.substring(
          text.indexOf("{"),
          text.lastIndexOf("}") + 1
        );

      const data =
        JSON.parse(jsonText);

      const rows =
        data.table.rows;

      displaySchedule(rows);

    })

    .catch(error => {

      console.error(
        "スケジュール取得エラー:",
        error
      );

      document.getElementById(
        "scheduleList"
      ).innerHTML =
        '<p class="schedule-empty">' +
        'スケジュールを取得できませんでした' +
        '</p>';

    });

}

/*
 * スケジュールを画面に表示
 */
function displaySchedule(rows) {

  const scheduleList =
    document.getElementById("scheduleList");


  /*
   * 今日の日付
   */
  const today = new Date();

  today.setHours(0, 0, 0, 0);


  /*
   * スプレッドシートの予定を
   * 日付ごとに保存
   */
  const scheduleMap = new Map();


  rows.forEach(row => {

    const cells = row.c;

    if (!cells[0]) {
      return;
    }


    /*
     * Google Sheetsの日付を取得
     */
    const dateValue =
      cells[0].v;


    /*
     * Visualization APIの日付は

       Date(2026,9,2)

       のような形式になることがあります。
     */
    const match =
      String(dateValue).match(
        /Date\((\d+),(\d+),(\d+)\)/
      );


    if (!match) {
      return;
    }


    const year =
      Number(match[1]);

    const month =
      Number(match[2]);

    const day =
      Number(match[3]);


    const date =
      new Date(year, month, day);


    const key =
      formatDateKey(date);


    /*
     * B列：時間
     * C列：内容
     */
    const time =
      cells[1]?.f ||
      cells[1]?.v ||
      "";

    const title =
      cells[2]?.f ||
      cells[2]?.v ||
      "";


    /*
     * 同じ日に複数の予定を登録できるようにする
     */

if (!scheduleMap.has(key)) {
  scheduleMap.set(key, []);
}

scheduleMap.get(key).push({
  time,
  title
});

  });


  /*
   * 今日から7日分を作る
   */
  let html = "";


  for (let i = 0; i < 7; i++) {

    const date =
      new Date(today);

    date.setDate(
      today.getDate() + i
    );


    const key =
      formatDateKey(date);


    const schedules =
    scheduleMap.get(key) || [];


    html +=
    createScheduleHTML(
        date,
        schedules,
        i === 0
    );

  }


  scheduleList.innerHTML =
    html;

}

/*
 * 日付を
 * YYYY-MM-DD
 * の形に変換
 */
function formatDateKey(date) {

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");


  return (
    year +
    "-" +
    month +
    "-" +
    day
  );

}

/*
 * 1日分のスケジュールを作る
 *
 * schedulesには、その日の予定が
 * 配列で入ってくる
 */
function createScheduleHTML(
  date,
  schedules,
  isToday
) {

  const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];

  const month =
    date.getMonth() + 1;

  const day =
    date.getDate();

  const weekday =
    weekdays[date.getDay()];


  /*
   * 今日だけTODAYを表示
   */
  const todayLabel =
    isToday
      ? '<span class="schedule-today">TODAY</span>'
      : "";


  /*
   * 予定なし
   */
  let content =
    '<div class="schedule-empty">' +
      '予定なし' +
    '</div>';


  /*
   * 予定が1件以上ある場合
   */
  if (schedules.length > 0) {

    content = "";

    schedules.forEach((schedule) => {

      const timeHTML =
        schedule.time
          ? '<span class="schedule-time">' +
              schedule.time +
            '</span>'
          : "";

      content +=
        '<div class="schedule-content">' +

          timeHTML +

          '<span class="schedule-title">' +
            schedule.title +
          '</span>' +

        '</div>';

    });

  }


  return (

    '<div class="schedule-item">' +

      '<div class="schedule-date">' +

        todayLabel +

        '<span>' +
          month +
          "/" +
          day +
          "（" +
          weekday +
          "）" +
        '</span>' +

      '</div>' +

      content +

    '</div>'

  );

}


/* スケジュール読み込み */
loadSchedule();
