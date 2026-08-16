// ==UserScript==
// @name         Inoreader Colorful Listview
// @namespace    http://inoreader.colorful.list.view
// @version      1.0.0
// @description  Inoreaderの記事リストをフィードソースごとにカラーリングする
// @author       zzznu
// @license      MIT
// @match        https://*.inoreader.com/*
// @match        https://inoreader.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// @homepageURL  https://github.com/zzznu/inoreader-colorful-listview
// @supportURL   https://github.com/zzznu/inoreader-colorful-listview/issues
// @downloadURL  https://raw.githubusercontent.com/zzznu/inoreader-colorful-listview/main/inoreader-colorful-listview.user.js
// @updateURL    https://raw.githubusercontent.com/zzznu/inoreader-colorful-listview/main/inoreader-colorful-listview.user.js
// ==/UserScript==
//
// Inspired by yamalight/feedly-colorful-list-view
// https://github.com/yamalight/feedly-colorful-list-view

(function () {
  'use strict';

  // -------------------------------------------------------
  // 設定（ライト/ダーク両対応）
  // 背景色を上書きせず半透明の色を重ねるため、
  // Inoreader側の地の色（ライト=白 / ダーク=黒）がそのまま残り、
  // どちらのテーマでも文字のコントラストが保たれる
  // -------------------------------------------------------
  const TINT = 0.18;           // 通常時の着色の濃さ(0-1)
  const TINT_HOVER = 0.32;     // ホバー時の着色の濃さ(0-1)
  const SAT_MIN = 35;          // 彩度の下限(%)
  const SAT_RANGE = 40;        // 彩度の振れ幅(%)

  // -------------------------------------------------------
  // セレクタ候補（新旧UI対応）
  // -------------------------------------------------------
  // 意図的に限定的なセレクタのみを使う。
  // [data-index] や .source のような汎用セレクタは、UI変更時に
  // サイドバー等の無関係な要素まで着色してしまうため採用しない。
  // 全て空振りした場合は「何も塗らない」で安全側に倒す
  const ROW_SELECTORS = [
    '.article_tile',           // 新デザイン（タイル/リストビュー共通）
    '.ar',                     // 旧デザイン
  ];
  const TITLE_SELECTORS = [
    '.article_tile_source',    // 新デザイン
    '.article_feed_title',     // 旧デザイン
    '.feed_title',             // 中間デザイン
    '.story_feed_title',       // 別バリアント
  ];

  // -------------------------------------------------------
  // 静的CSS（注入はこの一度だけ。フィード数が増えてもstyleは増えない）
  // 色は行ごとのCSSカスタムプロパティで渡す
  //
  // background-color ではなく background-image に単色グラデーションを敷く。
  // background-color は触らないので、Inoreaderの既読/選択中のハイライトも生き残る
  // -------------------------------------------------------
  const tint = (alpha) => {
    const c = `hsl(var(--ino-h) var(--ino-s) 50% / ${alpha})`;
    return `linear-gradient(${c}, ${c})`;
  };

  // GM_addStyle を提供しない環境（Greasemonkey系など）では
  // ReferenceError でスクリプト全体が停止するため素の実装で代替する
  const addStyle =
    typeof GM_addStyle === 'function'
      ? GM_addStyle
      : (css) =>
          document.head.appendChild(
            Object.assign(document.createElement('style'), { textContent: css })
          );

  addStyle(`
    [data-ino-color] {
      background-image: ${tint(TINT)} !important;
    }
    [data-ino-color]:hover {
      background-image: ${tint(TINT_HOVER)} !important;
    }
    .article_tile.unread .article_tile_source,
    .article_tile.unread .feed_title,
    .article_unreaded .article_feed_title,
    .story_unread .story_feed_title {
      font-weight: bold !important;
    }
  `);

  // -------------------------------------------------------
  // 色計算：FNV-1aハッシュ → 色相0-359 / 彩度SAT_MIN〜SAT_MIN+SAT_RANGE
  // 似た名前のフィードでも色が散らばる
  // -------------------------------------------------------
  const colorCache = new Map();

  function colorFor(title) {
    let c = colorCache.get(title);
    if (c) return c;
    let h = 0x811c9dc5;
    for (let i = 0; i < title.length; i++) {
      h ^= title.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h >>>= 0;
    c = { hue: h % 360, sat: SAT_MIN + ((h >>> 9) % (SAT_RANGE + 1)) };
    colorCache.set(title, c);
    return c;
  }

  // -------------------------------------------------------
  // 一度ヒットしたセレクタを覚えて次回以降は総当たりしない
  // （0件になったらUI変更とみなして再探索）
  // -------------------------------------------------------
  let rowSelector = null;
  let titleSelector = null;

  function findTitleEl(row) {
    if (titleSelector) {
      const el = row.querySelector(titleSelector);
      if (el) return el;
    }
    for (const sel of TITLE_SELECTORS) {
      const el = row.querySelector(sel);
      if (el) {
        titleSelector = sel;
        return el;
      }
    }
    return null;
  }

  function colorizeRow(row) {
    const titleEl = findTitleEl(row);
    if (!titleEl) return;
    const title = titleEl.textContent.trim();
    if (!title) return;
    // 仮想スクロールでDOMノードが別記事に再利用されても、
    // タイトルが変わっていればここを通過して塗り直される
    if (row.dataset.inoColor === title) return;
    row.dataset.inoColor = title;
    const { hue, sat } = colorFor(title);
    row.style.setProperty('--ino-h', String(hue));
    row.style.setProperty('--ino-s', sat + '%');
  }

  function colorizeAll() {
    let rows = null;
    if (rowSelector) {
      rows = document.querySelectorAll(rowSelector);
      if (rows.length === 0) rowSelector = null;
    }
    if (!rowSelector) {
      for (const sel of ROW_SELECTORS) {
        const found = document.querySelectorAll(sel);
        if (found.length > 0) {
          rowSelector = sel;
          rows = found;
          break;
        }
      }
    }
    if (rows) rows.forEach(colorizeRow);
  }

  // -------------------------------------------------------
  // MutationObserver：連続する変更をrequestAnimationFrameで
  // 1フレーム1回に間引く。監視はchildListのみなので
  // 自分自身の属性書き込みではループしない
  // -------------------------------------------------------
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      colorizeAll();
    });
  }

  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
  });

  colorizeAll();
})();
