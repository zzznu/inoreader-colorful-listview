// ==UserScript==
// @name         Inoreader Colorful Listview v2
// @namespace    http://inoreader.colorful.list.view
// @version      2.0.0
// @description  Inoreaderの記事リストをフィードソースごとにカラーリングする（高速・省メモリ版）
// @author       Based on yamalight's feedly-colorful-list-view
// @match        https://*.inoreader.com/*
// @match        https://inoreader.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  // -------------------------------------------------------
  // 設定（ライトテーマ用）
  // -------------------------------------------------------
  const LIGHTNESS = 92;        // 通常時の背景明度(%)
  const LIGHTNESS_HOVER = 86;  // ホバー時の背景明度(%)
  const SAT_MIN = 35;          // 彩度の下限(%)
  const SAT_RANGE = 40;        // 彩度の振れ幅(%)

  // -------------------------------------------------------
  // セレクタ候補（新旧UI対応）
  // -------------------------------------------------------
  const ROW_SELECTORS = [
    '.article_tile',           // 新デザイン（タイル/リストビュー共通）
    '.ar',                     // 旧デザイン
    '[data-index]',            // 仮想スクロール系
  ];
  const TITLE_SELECTORS = [
    '.article_tile_source',    // 新デザイン
    '.article_feed_title',     // 旧デザイン
    '.feed_title',             // 中間デザイン
    '.story_feed_title',       // 別バリアント
    '.source',                 // フォールバック
  ];

  // -------------------------------------------------------
  // 静的CSS（注入はこの一度だけ。フィード数が増えてもstyleは増えない）
  // 色は行ごとのCSSカスタムプロパティで渡す
  // -------------------------------------------------------
  GM_addStyle(`
    [data-ino-color] {
      background: hsl(var(--ino-h) var(--ino-s) ${LIGHTNESS}%) !important;
      transition: background 0.15s ease;
    }
    [data-ino-color]:hover {
      background: hsl(var(--ino-h) var(--ino-s) ${LIGHTNESS_HOVER}%) !important;
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
