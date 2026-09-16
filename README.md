# 謎陣 · Grid Hunt

100 關邏輯推理謎題 ＋ 每日挑戰。純靜態網頁，沒有打包工具、沒有相依套件，直接丟上 GitHub Pages 就能玩。

主角可以換：**貓咪、柴犬、珍奶、雞排、電鍋、馬桶、榴槤、外星人**。換了主角，標題、配色、連訊息裡的量詞都會跟著變（「同一列有兩顆榴槤」）。

![關卡](https://img.shields.io/badge/關卡-100-d97b34) ![模式](https://img.shields.io/badge/模式-每日挑戰%20%2F%20無盡-4f9e5e) ![技術](https://img.shields.io/badge/技術-原生%20HTML%2FCSS%2FJS-444)

## 玩法

盤面被切成幾個顏色區塊，要在每個區塊裡放一個主角：

- **一個顏色區塊一個** — 每個顏色區塊剛好一個
- **每列每欄各一個** — 橫的直的都不能重複
- **八個方向不相鄰** — 兩個不能上下左右或斜角貼在一起
- **三次機會** — 放錯三次這題就結束（可在設定關掉）

| 動作 | 效果 |
| --- | --- |
| 單點 | 標叉／取消叉 |
| 快速雙點 | 放上主角／收回 |
| 按住滑動 | 連續標叉 |
| 右鍵（電腦） | 直接放上 |
| 方向鍵 / 空白鍵 / Enter | 移動 / 標叉 / 放上 |

## 模式

- **闖關** — 100 關，5×5 一路到 10×10，記錄最佳時間，零提示零失誤拿 ⭐
- **每日挑戰** — 每天一題，題目由日期決定，所以同一天打開的人拿到同一張盤面（不需要伺服器）。有連續天數紀錄
- **無盡模式** — 自選 5×5 ～ 10×10，即時出題，永遠不重複

## 關於原創性

這個專案的規則屬於公有的邏輯謎題類型（Star Battle / N-Queens 變體，[Meowdoku](https://www.meowdoku.org/zh-tw/how-to-play)、LinkedIn Queens 等都是同一套）。**遊戲規則與機制本身不受著作權保護**，但別人的程式碼與美術資源受保護。

因此這裡的每一行程式碼、CSS、SVG 插圖都是為本專案重新寫、重新畫的，沒有複製任何既有網站的原始碼或素材。如果你要繼續改，請維持同樣做法：可以參考別人的規則和 UX 想法，不要複製檔案。

排行榜沒有做，那需要後端與帳號系統，超出「一個靜態網頁」的範圍。

## 本地執行

ES modules 不能用 `file://` 開啟，要起一個小型伺服器：

```bash
git clone https://github.com/chung223/cat-dog.git
cd cat-dog
python3 -m http.server 8000   # 或 npx serve .
```

然後開 <http://localhost:8000>。

## 部署到 GitHub Pages

兩種方式，擇一即可。

**A. 用內附的 Actions 流程（已設定好）**

`.github/workflows/pages.yml` 會在推到 `claude/game-redevelopment-mfaf56` 時自動測試並部署。只要到 repo 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions** 就會生效。

**B. 直接從分支部署**

**Settings → Pages → Source** 選 **Deploy from a branch**，分支選你要的那條、資料夾選 `/ (root)`。倉庫裡已經放了 `.nojekyll`，Jekyll 不會去動 `src/` 目錄。

網址會是 `https://chung223.github.io/cat-dog/`。

## 專案結構

```
index.html              版面
styles.css              樣式（含深色模式）
src/rng.js              可重現的亂數產生器
src/puzzle.js           出題與求解演算法
src/levels.js           預先產好的 100 關（由 tools 產生，勿手改）
src/game.js             盤面狀態與規則判定
src/mascots.js          八種主角的 SVG 插圖
src/storage.js          進度、每日紀錄與設定（localStorage）
src/main.js             畫面、輸入處理
tools/generate-levels.mjs   重新產生 src/levels.js
tools/verify-levels.mjs     驗證每一關都只有唯一解
```

## 出題演算法

難的不是「產生一個盤面」，而是「產生一個**只有唯一解**的盤面」。做法分三步：

1. **先放答案** — 隨機排出一組合法的主角位置。因為每列每欄各一個，「八方向不相鄰」其實只剩一條要檢查的規則：相鄰兩列的欄位至少要差 2。
2. **再長出顏色區塊** — 從每個主角出發向外做隨機 flood fill，直到填滿整個盤面。這樣每個區塊必定是連通的，而且剛好包含一個主角。
3. **修到唯一解** — 單純隨機產生的區塊常常有多組解（9×9 幾乎每次都是）。所以會反覆求解：每找到一組「非預期的解」，就把那組解用到、但正確解沒用到的某一格改判給隔壁區塊。這一格不會是任何一個正解位置，所以正解永遠存活，而那組雜解立刻失效。重複到只剩唯一解為止。

10×10 產一題大約要 0.3 秒，所以 100 關是先用 `tools/generate-levels.mjs` 產好存成資料（約 7 KB）；每日挑戰與無盡模式則是現場即時產生（每日挑戰最大只到 9×9，開起來不會卡）。

驗證：

```bash
node tools/verify-levels.mjs
```

會檢查 100 關 + 30 題隨機題目的區塊連通性、四條規則、以及唯一解。

## 想加新主角？

在 `src/mascots.js` 的陣列裡加一筆就好：

```js
{ id: 'duck', name: '鴨子', unit: '隻', accent: '#d9a33c', svg: `<svg class="mascot" viewBox="0 0 64 64">…</svg>` }
```

圖要在手機上約 34px 還看得清楚，所以線條粗一點、細節少一點。盤面顏色在 `styles.css` 最上面的 `--rg0` ~ `--rg9`。

## 授權

MIT，見 [LICENSE](LICENSE)。
