/**
 * 本站的 service worker（規格 13.2 B13）。純 JavaScript、沒有任何 import。
 * 建置後由 scripts/postbuild-sw.ts 讀取這個檔案，把下面的 CONFIG 換成實際設定（scripts/lib/sw-build.ts 的 renderServiceWorker），
 * 寫成 out/sw.js。常數（逾時、天數、上限、快取名稱）來自 src/lib/pwa.ts，用戶端與這裡共用同一份。
 * 檔案裡所有網址都是不含主機的路徑（由 basePath 組成）：這個 worker 不會、也不能向本站以外的地方發出請求（postbuild-check 會掃描）。
 *
 * 誠實原則：快取的頁面可能含有已經失效的邀請碼或優惠，所以
 * - 頁面（HTML）一律「網路優先」，不使用 stale-while-revalidate：網路正常時，使用者永遠拿到最新的內容；
 * - RSC 資料（Next.js 在頁面內換頁時的 .txt 請求）完全不經過 service worker，也不快取：「副本」標記只存在 HTML 裡，頁面無從得知一份 RSC 資料是不是副本，
 *   用了舊的就會在沒有日期、沒有警告的情況下顯示舊的邀請碼。離線時瀏覽器自己讓它失敗，Next.js 會改成整頁導覽，由下面導覽的規則回應（有 HTML 副本就連同儲存日期的提示一起）；
 * - 有副本時只等網路 navTimeoutMs；沒有副本就一直等網路；
 * - 以副本回應導覽時，在 HTML 的 <head> 注入 <meta name="rs-cache" content="儲存時間（毫秒）">，頁面據此顯示「這是 X 日儲存的副本」；
 * - 副本超過 maxAgeDays 一律不提供（刪除，改回應離線頁）；網路回 404 或 410 時，立刻刪除該頁的副本（下架的平台不能再從快取出現）。
 *
 * 靜態資源（_next/static）檔名帶內容雜湊，永遠不會變，所以用快取優先。
 * 不自動 skipWaiting：新版安裝後等待，由使用者在頁面上按「重新載入」才由頁面傳 SKIP_WAITING 啟用（避免開著的分頁在中途換版）。
 *
 * 快取名稱：github.io 的來源由同帳號的所有專案共用，所以清理時只動「rs-」開頭、而且不是目前三個名稱的快取，絕不碰別人的快取。
 * 所有快取的鍵都是「來源 + 路徑」，不含查詢字串（?q=、?c=、?p= 是用戶端狀態，?_rsc= 只是 Next.js 的快取破壞參數）。
 */
'use strict';

/**
 * @typedef {object} SwConfig
 * @property {string} version 建置版本（12 碼十六進位）；預先快取的名稱含它
 * @property {string} basePath 部署子路徑（無結尾斜線，可為空字串）
 * @property {string} scope basePath + 斜線
 * @property {string} defaultLocale 沒有網址前綴的語系
 * @property {Array<{url: string, rev: string}>} precache 安裝時要預先快取的路徑與內容雜湊
 * @property {Record<string, string>} offlineByLocale 各語系的離線頁路徑
 * @property {string} referrerMeta postbuild 在每頁 <head> 插入的 referrer meta：副本注入標記的錨點
 * @property {number} navTimeoutMs
 * @property {number} staleAfterDays
 * @property {number} maxAgeDays
 * @property {number} pagesMax
 * @property {number} assetsMax
 * @property {{cachePrefix: string, precachePrefix: string, pages: string, assets: string, cachedAtHeader: string, titleHeader: string, cacheMetaName: string}} names
 */

/** @type {SwConfig} */
const CONFIG = {"version":"795c09c91cce","basePath":"","scope":"/","defaultLocale":"zh-TW","precache":[{"url":"/","rev":"3dd28a2643ba"},{"url":"/_next/static/PZsT3nm8bPNEjZY5lvg1V/_buildManifest.js","rev":"9476e0afd3f9"},{"url":"/_next/static/PZsT3nm8bPNEjZY5lvg1V/_clientMiddlewareManifest.js","rev":"5483e3295dc3"},{"url":"/_next/static/PZsT3nm8bPNEjZY5lvg1V/_ssgManifest.js","rev":"94840abcb530"},{"url":"/_next/static/chunks/0-3y3zdexua2t.js","rev":"978a2038e55e"},{"url":"/_next/static/chunks/0298iacbz6_e2.js","rev":"489099dd25c1"},{"url":"/_next/static/chunks/09ql8evr-gbh1.js","rev":"b43bd51763c3"},{"url":"/_next/static/chunks/0chgn5zf0ltp3.css","rev":"501e5c8fd79b"},{"url":"/_next/static/chunks/0cz1d0mv5g_q7.js","rev":"0973c1d64c88"},{"url":"/_next/static/chunks/0eyizb4uvb8w3.css","rev":"8cd643bddc7d"},{"url":"/_next/static/chunks/0muek_-vn32rb.js","rev":"33fc6f46c919"},{"url":"/_next/static/chunks/0o979yj-3oy6w.js","rev":"652dc3889d9a"},{"url":"/_next/static/chunks/1-0jh_m-rjjhz.js","rev":"a4863fa114de"},{"url":"/_next/static/chunks/104eyzuf_vq9a.css","rev":"b160dd6e872b"},{"url":"/_next/static/chunks/11brvx6iuzyj0.css","rev":"f4bea9ceea05"},{"url":"/_next/static/chunks/11d8zwlkp5qbj.js","rev":"f84d11ab8d1d"},{"url":"/_next/static/chunks/12u54fr2tlgd8.js","rev":"ea51afc76f89"},{"url":"/_next/static/chunks/1_k6wabxlx-9l.css","rev":"244b5098a7ee"},{"url":"/_next/static/chunks/1votxl86zdmqq.js","rev":"56c6ac973946"},{"url":"/_next/static/chunks/27vyoapfib7on.css","rev":"1957ee12858d"},{"url":"/_next/static/chunks/2eb1780h0f962.css","rev":"f129cbb5e5ee"},{"url":"/_next/static/chunks/2hxhim6ti791q.js","rev":"180f6a6015ca"},{"url":"/_next/static/chunks/3pobbildgrssa.css","rev":"61a1b07effed"},{"url":"/_next/static/chunks/3wgmwdf4rwjht.js","rev":"8d0355ca86be"},{"url":"/_next/static/chunks/408p5rk-_req2.js","rev":"60d6fd2346a8"},{"url":"/_next/static/chunks/turbopack-3-ry682tkyiqk.js","rev":"8bbb58cbfd46"},{"url":"/apple-touch-icon.png","rev":"c96b0aa64c4c"},{"url":"/en/","rev":"9f22dd423d3b"},{"url":"/en/offline/","rev":"4b8e4dda6820"},{"url":"/icon-192.png","rev":"bc7341d85d4c"},{"url":"/icon-512.png","rev":"1ce453b57778"},{"url":"/icon.svg","rev":"98183a6e844c"},{"url":"/ja/","rev":"fc33cdc81d67"},{"url":"/ja/offline/","rev":"1ca5ac6c2843"},{"url":"/ko/","rev":"adcc2892a9e8"},{"url":"/ko/offline/","rev":"3a2f7a8e265c"},{"url":"/manifest.en.webmanifest","rev":"bcb40801d40a"},{"url":"/manifest.ja.webmanifest","rev":"ac04ad57f9b7"},{"url":"/manifest.ko.webmanifest","rev":"32788b69c406"},{"url":"/manifest.webmanifest","rev":"f097d9d45c5a"},{"url":"/offline/","rev":"e9d88ee751a3"}],"offlineByLocale":{"zh-TW":"/offline/","en":"/en/offline/","ja":"/ja/offline/","ko":"/ko/offline/"},"referrerMeta":"<meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"/>","navTimeoutMs":3000,"staleAfterDays":7,"maxAgeDays":30,"pagesMax":60,"assetsMax":240,"names":{"cachePrefix":"rs-","precachePrefix":"rs-pre-","pages":"rs-pages-v1","assets":"rs-assets-v1","cachedAtHeader":"x-rs-cached-at","titleHeader":"x-rs-title","cacheMetaName":"rs-cache"}};

const NAMES = CONFIG.names;
const ORIGIN = self.location.origin;
const PRE_CACHE = NAMES.precachePrefix + CONFIG.version;
const PAGES_CACHE = NAMES.pages;
const ASSETS_CACHE = NAMES.assets;

const DAY_MS = 24 * 60 * 60 * 1000;
/** 副本的儲存時間比現在晚超過這段時間：裝置時鐘被調整過或標頭被竄改，不信任 */
const FUTURE_SKEW_MS = DAY_MS;
/** 安裝時同時進行的下載數 */
const PRECACHE_CONCURRENCY = 6;
/** 頁面請 service worker 預先快取的網址：最多處理幾筆、最多接受幾筆 */
const WARM_SCAN_MAX = 200;
const WARM_MAX = 40;

const SW_PATH = CONFIG.basePath + '/sw.js';
const STATIC_PREFIX = CONFIG.basePath + '/_next/static/';
/** 這些路徑底下的請求不經過 service worker（社群預覽圖、QR code、API 檔案都不需要離線，也不該佔空間） */
const IGNORED_PREFIXES = ['/og/', '/qr/', '/api/'].map((prefix) => CONFIG.basePath + prefix);
/** 其餘可以用 stale-while-revalidate 的同源檔案（圖示、manifest）：它們不含任何會過期的資料 */
const STATIC_FILE_RE = /\.(?:png|svg|ico|webp|avif|jpe?g|gif|webmanifest|woff2|css|js)$/i;
/** 預先快取、WARM 可以要求的靜態資源 */
const WARM_ASSET_RE = /\.(?:js|css|woff2|png|svg|webp|avif|jpe?g|gif|ico)$/i;
/** 重新包裝回應時不帶過去的標頭：本文已被瀏覽器解碼，長度與編碼標頭不再正確；Vary 對自己決定的快取鍵沒有意義（Vary: * 還會讓 cache.put 失敗） */
const DROPPED_HEADERS = /^(?:content-length|content-encoding|transfer-encoding|set-cookie|vary)$/i;

/** 各語系的離線頁；鍵是語系，值是路徑 */
const OFFLINE_BY_LOCALE = new Map(Object.entries(CONFIG.offlineByLocale));
const OFFLINE_PATHS = new Set(OFFLINE_BY_LOCALE.values());

// ---------- 小工具 ----------

/** 快取的鍵：來源 + 路徑（不含查詢字串與錨點） */
function keyOf(pathname) {
  return ORIGIN + pathname;
}

function inScope(pathname) {
  return pathname.startsWith(CONFIG.scope);
}

/** 頁面路徑（要回 HTML 的網址）：以斜線結尾，或最後一段沒有副檔名（使用者手打的網址可能少了斜線） */
function isPagePath(pathname) {
  return pathname.endsWith('/') || pathname.lastIndexOf('.') < pathname.lastIndexOf('/');
}

/** 頁面的快取鍵統一加上結尾斜線：本站所有頁面都是 trailingSlash，少了斜線的網址會被主機 301 到有斜線的 */
function pageKey(pathname) {
  return keyOf(pathname.endsWith('/') ? pathname : pathname + '/');
}

/** 網址屬於哪個語系：scope 之後的第一段是 CONFIG.offlineByLocale 的語系（不含預設語系）就是它，其餘一律是預設語系 */
function localeOf(pathname) {
  const first = pathname.slice(CONFIG.basePath.length).split('/')[1] || '';
  return first !== CONFIG.defaultLocale && OFFLINE_BY_LOCALE.has(first) ? first : CONFIG.defaultLocale;
}

function isOfflinePath(pathname) {
  return OFFLINE_PATHS.has(pathname.endsWith('/') ? pathname : pathname + '/');
}

/** 與 src/lib/pwa.ts 的 parseCachedAt 相同：只接受正整數的毫秒時間戳記 */
function parseCachedAt(value) {
  if (!value || !/^\d{1,16}$/.test(value)) return undefined;
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

const ENTITY_RE = /&(?:#x([0-9a-f]+)|#(\d+)|(amp|lt|gt|quot|apos));/gi;
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(text) {
  return text.replace(ENTITY_RE, (match, hex, dec, named) => {
    if (named) return NAMED_ENTITIES[named.toLowerCase()] || match;
    const code = hex ? parseInt(hex, 16) : parseInt(dec, 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

/** 頁面 <title> 的文字，轉成可放進標頭的形式（百分比編碼，最多 120 個字元）；讀不到或無法編碼就回傳空字串 */
function titleHeaderOf(html) {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html);
  if (!match) return '';
  try {
    const text = decodeEntities(match[1]).replace(/\s+/g, ' ').trim();
    return encodeURIComponent(Array.from(text).slice(0, 120).join(''));
  } catch {
    return '';
  }
}

/** 複製標頭（去掉本文已不適用的），再加上儲存時間與標題；這兩個標頭只存在快取裡 */
function stampedHeaders(source, savedAt, title) {
  const headers = new Headers();
  source.forEach((value, name) => {
    if (!DROPPED_HEADERS.test(name) && name.toLowerCase() !== NAMES.cachedAtHeader && name.toLowerCase() !== NAMES.titleHeader) {
      headers.set(name, value);
    }
  });
  headers.set(NAMES.cachedAtHeader, String(savedAt));
  if (title) headers.set(NAMES.titleHeader, title);
  return headers;
}

/** 可以放進快取的網路回應：200、同源、不是重新導向的結果（把重新導向的回應當成導覽的回應會被瀏覽器拒絕） */
function isCacheable(response) {
  return response.status === 200 && response.type === 'basic' && !response.redirected;
}

/** 只取出必要的標頭判斷「像不像 HTML」；擋下登入頁（captive portal）等把任何網址都回成 HTML 的網路 */
function isHtml(response) {
  return /html/i.test(response.headers.get('content-type') || '');
}

/** 不會 reject 的 Promise：結果是 { res } 或 { err }，讓逾時競賽與後續處理不必到處加 catch */
function settle(promise) {
  return promise.then(
    (res) => ({ res }),
    (err) => ({ err }),
  );
}

const TIMED_OUT = { timeout: true };

/** 等 promise（不會 reject）最多 ms 毫秒；逾時回傳 TIMED_OUT，promise 本身繼續進行 */
function withTimeout(promise, ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    promise.then((value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

/** 依序領取工作，最多 limit 個同時進行；第一個失敗後不再領取新工作，等進行中的做完後丟出那個錯誤 */
async function runPool(items, limit, task) {
  let next = 0;
  let failure;
  async function worker() {
    while (failure === undefined && next < items.length) {
      const item = items[next++];
      try {
        await task(item);
      } catch (error) {
        failure = { error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failure !== undefined) throw failure.error;
}

/** 網路請求一律先向伺服器驗證（cache: 'no-cache'）：繞過 GitHub Pages 的 max-age=600，通常只是 304，不會重新下載。用 async 讓同步丟出的錯誤也變成 reject */
async function fetchFresh(request) {
  return fetch(request, { cache: 'no-cache' });
}

// ---------- 快取的讀寫 ----------

/** 刪掉最舊的項目，讓符合 test 的項目不超過 max 個（Cache.keys() 依寫入順序，put 會移到最後） */
async function trim(cache, test, max) {
  const keys = (await cache.keys()).filter((request) => test(new URL(request.url).pathname));
  const excess = keys.length - max;
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

/** 把網路回應存成頁面副本（HTML）：只存「確實是本站頁面」的回應，並蓋上儲存時間與標題。成功回傳 true */
async function storePage(key, response) {
  try {
    if (!isCacheable(response) || !isHtml(response)) return false;
    const body = await response.arrayBuffer();
    const html = new TextDecoder().decode(body);
    // 沒有 postbuild 插入的 referrer meta，就不是本站輸出的頁面（登入頁、被改寫過的內容）；也無法注入副本標記
    if (!html.includes(CONFIG.referrerMeta)) return false;
    const copy = new Response(body, { status: 200, statusText: 'OK', headers: stampedHeaders(response.headers, Date.now(), titleHeaderOf(html)) });
    const cache = await caches.open(PAGES_CACHE);
    await cache.put(key, copy);
    await trim(cache, () => true, CONFIG.pagesMax);
    return true;
  } catch {
    return false;
  }
}

/** 靜態資源與圖示：原樣存入 rs-assets，超過上限刪最舊的 */
async function storeAsset(key, response) {
  try {
    if (!isCacheable(response)) return;
    const cache = await caches.open(ASSETS_CACHE);
    await cache.put(key, response);
    await trim(cache, () => true, CONFIG.assetsMax);
  } catch {
    // 空間不足或被封鎖：沒有快取只是少了離線能力，不影響頁面
  }
}

/** 在指定的快取裡找；讀快取失敗（例如 Chrome 的 UnknownError: Internal error opening backing store）視同沒有，不讓請求跟著失敗 */
async function matchIn(key, cacheName) {
  try {
    return await caches.match(key, { cacheName });
  } catch {
    return undefined;
  }
}

async function deleteFrom(cacheName, request) {
  try {
    const cache = await caches.open(cacheName);
    return await cache.delete(request);
  } catch {
    return false;
  }
}

/** 網路說這個頁面已經不存在（404、410）：刪掉它的 HTML 副本（與同一資料夾裡可能殘留的 .txt 副本） */
async function purgePage(pathname) {
  try {
    const dir = pathname.endsWith('/') ? pathname : pathname + '/';
    const cache = await caches.open(PAGES_CACHE);
    for (const request of await cache.keys()) {
      const at = new URL(request.url).pathname;
      // 資料夾本身（HTML）與直接放在其中的 .txt 檔；更深一層是別的頁面，不動
      if (at === dir || (at.startsWith(dir) && !at.slice(dir.length).includes('/'))) await cache.delete(request);
    }
  } catch {
    // 刪不掉也不阻擋回應
  }
}

/**
 * 找出可以提供的副本：在頁面快取與預先快取中各找一份，只取有合法儲存時間的；
 * 時間在未來（超過一天）或超過 maxAgeDays 的副本刪除並視為不存在（離線頁沒有資料，不受天數限制）。
 * 兩份都可用時取較新的。回傳 { response, savedAt } 或 undefined。
 */
async function findCopy(key, pathname) {
  const now = Date.now();
  let best;
  for (const cacheName of [PAGES_CACHE, PRE_CACHE]) {
    let response;
    try {
      response = await caches.match(key, { cacheName });
    } catch {
      response = undefined;
    }
    if (!response) continue;
    const savedAt = parseCachedAt(response.headers.get(NAMES.cachedAtHeader));
    const tooOld = savedAt !== undefined && !isOfflinePath(pathname) && (now - savedAt) / DAY_MS > CONFIG.maxAgeDays;
    if (savedAt === undefined || savedAt - now > FUTURE_SKEW_MS || tooOld) {
      await deleteFrom(cacheName, key);
      continue;
    }
    if (best === undefined || savedAt > best.savedAt) best = { response, savedAt };
  }
  return best;
}

/** 以副本回應導覽：在 referrer meta 之後注入 <meta name="rs-cache">。錨點不見就原樣回傳（寧可沒有提示，也不弄壞頁面） */
async function copyResponse(copy, pathname) {
  const response = copy.response;
  if (isOfflinePath(pathname)) return response; // 離線頁本身不是資料，沒有「儲存日期」可說
  try {
    const html = await response.clone().text();
    const at = html.indexOf(CONFIG.referrerMeta);
    if (at === -1 || html.includes('name="' + NAMES.cacheMetaName + '"')) return response;
    const insertAt = at + CONFIG.referrerMeta.length;
    const marker = '<meta name="' + NAMES.cacheMetaName + '" content="' + String(copy.savedAt) + '"/>';
    return new Response(html.slice(0, insertAt) + marker + html.slice(insertAt), { status: 200, statusText: 'OK', headers: response.headers });
  } catch {
    return response;
  }
}

/** 沒有可用的副本：回應該語系預先快取的離線頁（狀態 200）。只用於導覽；連離線頁都沒有時回傳網路錯誤 */
async function offlineResponse(pathname) {
  const target = OFFLINE_BY_LOCALE.get(localeOf(pathname));
  try {
    const hit = target ? await caches.match(keyOf(target), { cacheName: PRE_CACHE }) : undefined;
    return hit || Response.error();
  } catch {
    return Response.error();
  }
}

// ---------- 安裝與啟用 ----------

async function precacheAll() {
  // 同一版本只可能是上次失敗留下的殘缺快取；先清掉，成功時快取內就恰好是清單上的檔案
  await caches.delete(PRE_CACHE);
  const cache = await caches.open(PRE_CACHE);
  try {
    await runPool(CONFIG.precache, PRECACHE_CONCURRENCY, async (entry) => {
      // cache: 'reload'：繞過 HTTP 快取（GitHub Pages 的 max-age=600），確保預先快取的是這一版的檔案，而不是十分鐘前的舊檔
      const response = await fetch(ORIGIN + entry.url, { cache: 'reload' });
      if (!isCacheable(response)) throw new Error('預先快取失敗：' + entry.url + '（狀態 ' + String(response.status) + '）');
      if (entry.url.endsWith('/')) {
        if (!isHtml(response)) throw new Error('預先快取失敗：' + entry.url + ' 不是 HTML');
        const body = await response.arrayBuffer();
        const html = new TextDecoder().decode(body);
        if (!html.includes(CONFIG.referrerMeta)) throw new Error('預先快取失敗：' + entry.url + ' 不是本站輸出的頁面');
        const copy = new Response(body, { status: 200, statusText: 'OK', headers: stampedHeaders(response.headers, Date.now(), titleHeaderOf(html)) });
        await cache.put(ORIGIN + entry.url, copy);
      } else {
        if (isHtml(response)) throw new Error('預先快取失敗：' + entry.url + ' 回應了 HTML');
        await cache.put(ORIGIN + entry.url, response);
      }
    });
  } catch (error) {
    // 任何一個失敗都放棄整個安裝：舊版 service worker 與它的快取原封不動，之後的更新檢查會重試
    await caches.delete(PRE_CACHE);
    throw error;
  }
}

/**
 * 舊版預先快取被刪除之前，把它的 JS 與 CSS 搬到 rs-assets：已儲存的頁面副本（rs-pages）引用的是「它被儲存時那一版」的檔案，
 * 新版啟用後如果這些檔案也被刪掉，離線時副本只剩沒有互動的靜態 HTML，連「這是 X 日儲存的副本」的提示都出不來（提示由 JS 顯示）。
 * 新版預先快取裡已經有的檔案不用搬；rs-assets 有上限（assetsMax），超過時刪最舊的。失敗（空間不足）只是少了離線互動，不影響啟用
 */
async function keepStatic(oldCacheName) {
  try {
    const from = await caches.open(oldCacheName);
    const to = await caches.open(ASSETS_CACHE);
    for (const request of await from.keys()) {
      const pathname = new URL(request.url).pathname;
      if (!pathname.startsWith(STATIC_PREFIX) || !/\.(?:js|css)$/.test(pathname)) continue;
      if (await matchIn(request, PRE_CACHE)) continue;
      const response = await from.match(request);
      if (response) await to.put(request, response);
    }
    await trim(to, () => true, CONFIG.assetsMax);
  } catch {
    // 空間不足或被封鎖：只是少了離線互動
  }
}

async function cleanupAndClaim() {
  const keep = new Set([PRE_CACHE, PAGES_CACHE, ASSETS_CACHE]);
  const names = await caches.keys();
  const stale = names.filter((name) => name.startsWith(NAMES.cachePrefix) && !keep.has(name));
  for (const name of stale) if (name.startsWith(NAMES.precachePrefix)) await keepStatic(name);
  // 只動「rs-」開頭的快取：同一個 github.io 來源上，其他專案的快取不是我們的。刪不掉一個不該讓啟用失敗
  await Promise.allSettled(stale.map((name) => caches.delete(name)));
  try {
    await self.clients.claim();
  } catch {
    // 接管失敗只是這一次載入的分頁要等下次導覽才受控，不影響功能
  }
}

// 沒有 skipWaiting：新版等到舊版的分頁都關閉，或使用者按下「重新載入」（SKIP_WAITING 訊息）才啟用
self.addEventListener('install', (event) => {
  event.waitUntil(precacheAll());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(cleanupAndClaim());
});

// ---------- 請求 ----------

/** 靜態資源（_next/static）：檔名含雜湊、內容不會變，快取優先；沒有就上網並寫入 rs-assets */
async function handleStatic(event, url) {
  const key = keyOf(url.pathname);
  const hit = (await matchIn(key, PRE_CACHE)) || (await matchIn(key, ASSETS_CACHE));
  if (hit) return hit;
  try {
    const response = await fetch(event.request);
    if (isCacheable(response)) event.waitUntil(storeAsset(key, response.clone()));
    return response;
  } catch {
    return Response.error();
  }
}

/** 網路回應到手後的處理：回傳要交給頁面的回應，或 undefined（改用副本／離線頁） */
function acceptNetwork(event, response, onOk, pathname, purge) {
  if (isCacheable(response)) {
    event.waitUntil(onOk(response.clone()));
    return response;
  }
  if (response.status === 404 || response.status === 410) {
    event.waitUntil(purge(pathname));
    return response;
  }
  // 5xx：伺服器暫時出問題，視同網路失敗；其餘（重新導向、不透明回應、403 等）照原樣交給瀏覽器，不快取
  return response.status >= 500 ? undefined : response;
}

/** 網路逾時後才到的回應：只更新快取，不能再回應頁面了 */
function updateLate(pending, onOk, pathname, purge) {
  return pending.then(async (outcome) => {
    const response = outcome.res;
    if (!response) return;
    if (isCacheable(response)) await onOk(response);
    else if (response.status === 404 || response.status === 410) await purge(pathname);
  });
}

/** 導覽（HTML）：網路優先。網路正常就用網路並更新副本；網路失敗、5xx 或太慢才用副本，再不行就用離線頁 */
async function handleNavigation(event, url) {
  const key = pageKey(url.pathname);
  const copy = await findCopy(key, url.pathname);
  const pending = settle(fetchFresh(event.request));
  const outcome = copy ? await withTimeout(pending, CONFIG.navTimeoutMs) : await pending;
  const store = (response) => storePage(key, response);

  if (outcome.res) {
    const accepted = acceptNetwork(event, outcome.res, store, url.pathname, purgePage);
    if (accepted) return accepted;
  }
  if (copy) {
    if (outcome.timeout) event.waitUntil(updateLate(pending, store, url.pathname, purgePage));
    return copyResponse(copy, url.pathname);
  }
  return offlineResponse(url.pathname);
}

/** 圖示與 manifest：stale-while-revalidate（這些檔案不含會過期的資料） */
async function handleStaticFile(event, url) {
  const key = keyOf(url.pathname);
  const refresh = fetch(event.request).then(async (response) => {
    if (isCacheable(response)) await storeAsset(key, response.clone());
    return response;
  });
  const hit = (await matchIn(key, ASSETS_CACHE)) || (await matchIn(key, PRE_CACHE));
  if (hit) {
    // 先回應舊的；背景更新要讓 service worker 活到完成（waitUntil 必須在回應期間登記），失敗就算了
    event.waitUntil(refresh.then(() => undefined, () => undefined));
    return hit;
  }
  try {
    return await refresh;
  } catch {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || request.headers.has('range')) return;
  // 瀏覽器已知問題：開著 DevTools 時會出現 only-if-cached 且非同源模式的請求，fetch 它會丟出 TypeError
  if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;
  const url = new URL(request.url);
  if (url.origin !== ORIGIN || !inScope(url.pathname)) return;
  if (url.pathname === SW_PATH || IGNORED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(handleStatic(event, url));
  } else if (request.mode === 'navigate') {
    // 只處理頁面；導覽到檔案（robots.txt、sitemap.xml、圖片）交給瀏覽器，離線頁不是它們的替身
    if (isPagePath(url.pathname)) event.respondWith(handleNavigation(event, url));
  } else if (STATIC_FILE_RE.test(url.pathname)) {
    event.respondWith(handleStaticFile(event, url));
  }
});

// ---------- 訊息 ----------

/** 預先快取頁面請求的網址：同源、在 scope 內、不是 sw.js 與忽略的路徑，而且是頁面或靜態資源；最多 WARM_MAX 筆 */
async function warm(urls) {
  if (!Array.isArray(urls)) return;
  const accepted = new Map();
  for (const raw of urls.slice(0, WARM_SCAN_MAX)) {
    if (accepted.size >= WARM_MAX) break;
    if (typeof raw !== 'string' || raw.length > 2048) continue;
    let url;
    try {
      url = new URL(raw, ORIGIN);
    } catch {
      continue;
    }
    const pathname = url.pathname;
    if (url.origin !== ORIGIN || !inScope(pathname) || pathname === SW_PATH) continue;
    if (IGNORED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) continue;
    if (pathname.startsWith(STATIC_PREFIX)) {
      if (WARM_ASSET_RE.test(pathname)) accepted.set(pathname, 'asset');
    } else if (isPagePath(pathname)) {
      accepted.set(pageKey(pathname).slice(ORIGIN.length), 'page');
    }
  }
  await runPool([...accepted], 4, async ([pathname, kind]) => {
    try {
      const key = keyOf(pathname);
      if (kind === 'page') {
        await storePage(key, await fetch(key, { cache: 'no-cache' }));
        return;
      }
      if ((await matchIn(key, PRE_CACHE)) || (await matchIn(key, ASSETS_CACHE))) return;
      await storeAsset(key, await fetch(key));
    } catch {
      // 網路失敗：這一筆跳過，不影響其他的
    }
  });
}

/** 訊息只接受來自本站 scope 內視窗的：同一個來源上，其他專案的頁面也能取得我們的 registration，不能讓它們指揮我們 */
function isOwnWindow(source) {
  if (!source || source.type !== 'window' || typeof source.url !== 'string') return false;
  try {
    const url = new URL(source.url);
    return url.origin === ORIGIN && inScope(url.pathname);
  } catch {
    return false;
  }
}

self.addEventListener('message', (event) => {
  if (!isOwnWindow(event.source)) return;
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
  else if (data.type === 'WARM') event.waitUntil(warm(data.urls));
});
