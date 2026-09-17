# 謎陣 · Grid Hunt

100 關邏輯推理謎題 ＋ 每日挑戰。純靜態網頁，沒有打包工具、沒有相依套件，直接丟上 GitHub Pages 就能玩。

主角可以換：**大便、貓咪、柴犬、珍奶、雞排、電鍋、馬桶、榴槤、外星人**。換了主角，標題、配色、連訊息裡的量詞都會跟著變（「同一列有兩顆榴槤」「同一列有兩坨大便」）。

主角還可以自帶專屬的「叉」圖示——預設的大便主角就是把每一格叉叉換成馬桶。

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

- **闖關** — 100 關，難度照「推理技巧」排（見下），記錄最佳時間，零提示零失誤拿 ⭐
- **玩法教學** — 五種推理各一課，每課是一張剛好非用那招不可的小盤面
- **每日挑戰** — 每天一題，題目由日期決定，所以同一天打開的人拿到同一張盤面（不需要伺服器）。有連續天數紀錄，過關後可以分享成績（不會劇透答案）
- **無盡模式** — 自選盤面大小（5×5 ～ 10×10）**和難度**，即時出題，永遠不重複

- **排行榜** — 每日挑戰的成績榜。預設是本機版（只有自己的紀錄），接上後端就變成共用的，見下

盤面中途離開會存著，回首頁按「接著玩」就繼續，關掉瀏覽器也還在。

## 關於原創性

這個專案的規則屬於公有的邏輯謎題類型（Star Battle / N-Queens 變體，[Meowdoku](https://www.meowdoku.org/zh-tw/how-to-play)、LinkedIn Queens 等都是同一套）。**遊戲規則與機制本身不受著作權保護**，但別人的程式碼與美術資源受保護。

因此這裡的每一行程式碼、CSS、SVG 插圖都是為本專案重新寫、重新畫的，沒有複製任何既有網站的原始碼或素材。如果你要繼續改，請維持同樣做法：可以參考別人的規則和 UX 想法，不要複製檔案。

排行榜的程式碼是自己寫的，後端用 Supabase（設定方式見下）。

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

## 排行榜

**先講清楚：這種排行榜擋不住作弊。** 整個遊戲跑在瀏覽器裡，上傳的秒數就是前端說了算，沒有任何東西能證明那一局真的發生過。要能驗證就得把每一步都送到伺服器重算，那是另一個量級的工程。所以這裡的定位是「一群人一起玩的記分板」，不是競技排名——UI 上也是這樣寫的。

沒設定後端時，排行榜自動變成**本機版**：只列出你自己每天的成績。這個不用設定就能用。

### 開共用排行榜（約五分鐘）

1. 開一個免費的 [Supabase](https://supabase.com) 專案。
2. 到 SQL Editor 執行：

```sql
create table public.scores (
  id         bigint generated always as identity primary key,
  day        text        not null,
  name       text        not null,
  seconds    integer     not null,
  mistakes   integer     not null,
  hints      integer     not null,
  size       integer     not null,
  created_at timestamptz not null default now()
);

create index scores_day_seconds_idx on public.scores (day, seconds);

alter table public.scores enable row level security;

create policy "anyone can read" on public.scores
  for select using (true);

create policy "anyone can post today" on public.scores
  for insert with check (
    char_length(name) between 1 and 16
    and seconds  between 1 and 86400
    and mistakes between 0 and 3
    and hints    between 0 and 200
    and size     between 5 and 10
    -- 前後各留一天，免得時區不同的人被擋掉
    and day between to_char((now() - interval '1 day')::date, 'YYYY-MM-DD')
                and to_char((now() + interval '1 day')::date, 'YYYY-MM-DD')
  );
```

沒有寫 update / delete 的政策，所以沒有人改得掉或刪得掉別人的紀錄。

3. 把 Project URL 和 anon key 填進 `src/config.js`，推上去就生效。

**anon key 是可以公開的**，本來就設計成放在前端；擋住濫用的是上面那段 RLS 政策，不是把 key 藏起來。

想先試不想改檔案的話，在瀏覽器 console 跑：

```js
localStorage.setItem('shiba-grid/leaderboard', JSON.stringify({ url: 'https://xxx.supabase.co', anonKey: '...' }))
```

## 專案結構

```
index.html              版面
styles.css              樣式（含深色模式）
src/rng.js              可重現的亂數產生器
src/puzzle.js           出題與求解演算法
src/levels.js           預先產好的 100 關（由 tools 產生，勿手改）
src/game.js             盤面狀態與規則判定
src/mascots.js          八種主角的 SVG 插圖
src/storage.js          進度、每日紀錄、暫存盤面與設定（localStorage）
src/analyze.js          人類技巧解題器（難度評級＋提示）
src/config.js           排行榜後端設定（留空＝本機版）
src/leaderboard.js      排行榜的讀寫
src/main.js             畫面、輸入處理
tools/generate-levels.mjs   重新產生 src/levels.js
tools/verify-levels.mjs     驗證每一關都只有唯一解
```

## 難度是怎麼定的

**盤面大小不是難度。** 實測 160 題隨機盤面：5×5 有 5% 需要最高階的推理，10×10 卻有 7% 只需要第二階。一個區塊肥肥胖胖的 10×10，可以比一個區塊互相咬死的 7×7 還好解。

所以難度改用另一個東西衡量：**這一關最難「非用不可」的推理是哪一種。** `src/analyze.js` 是一個只會用人類技巧的解題器，永遠先試最好想的那一招，卡住了才升級：

| 階 | 技巧 | 內容 |
| --- | --- | --- |
| 1 | 唯一格 | 某一列／欄／區塊只剩一格能放 |
| 2 | 區塊鎖定 | 某區塊的可能位置全擠在同一列，那列其他格就死了 |
| 3 | 共同排除 | 某區塊不管放哪裡，都會殺掉同一格 |
| 4 | 集合配對 | k 個區塊的可能位置只落在 k 列裡，那 k 列被它們包了 |
| 5 | 假設反證 | 假設放這裡 → 推到矛盾 → 不能放 |

一題的難度＝解題器被迫用到的最高階。100 關就照「階級優先、尺寸其次」排，所以難度不會倒退（舊版第 80 關是第 4 階、第 100 關卻只有第 3 階，就是因為只看尺寸）。

分佈：第 1 階 10 關、第 2 階 14 關、第 3 階 24 關、第 4 階 26 關、第 5 階 26 關。

排關卡有兩個容易踩的坑，出題工具都處理了：

- **不能從難度池的前面拿。** 池子由易到難排序後直接取前 N 個，整個遊戲就會被壓在每一階的最低端——第一版就是這樣，最後一關比中間還簡單。現在是在整個池子上等距取樣，所以每一段的最後一關都逼近該池的上限。
- **同一階跨兩種盤面時要接起來。** 不然從 9×9 換到 10×10 會把難度打回原點，玩家會覺得盤面變大反而變簡單。第二段是從自己池子的 45% 處起跳的。

`tools/verify-levels.mjs` 會擋這兩件事：每一段必須往上爬，而且最後一關必須排進全遊戲最難的前五名。

三個附帶好處：

- **100 關全部保證純邏輯可解**，一次都不用猜。出題時解不出來的直接丟掉。
- **提示會講人話。** 同一支解題器從你目前的盤面往下推一步，所以提示是「用『共同排除』：這個顏色區塊不管放在哪一格，都會殺掉標起來的格子」，還會把相關的格子圈起來——不是直接告訴你答案在哪。
  提示會把**你畫的叉也算進去**，不然純排除型的推理每次都會推出同一步，永遠推不完。
- **教學關是自動挑的。** 出題工具會找「剛好只需要這一招、而且這一招在第 1～3 步就出現」的小盤面，所以一上課就會撞到重點，不用先解十步無聊的。每種技巧第一次在闖關中變成必要時，遊戲也會主動問你要不要先上那一課。

## 出題演算法

難的不是「產生一個盤面」，而是「產生一個**只有唯一解**的盤面」。做法分三步：

1. **先放答案** — 隨機排出一組合法的主角位置。因為每列每欄各一個，「八方向不相鄰」其實只剩一條要檢查的規則：相鄰兩列的欄位至少要差 2。
2. **再長出顏色區塊** — 從每個主角出發向外做隨機 flood fill，直到填滿整個盤面。這樣每個區塊必定是連通的，而且剛好包含一個主角。
3. **修到唯一解** — 單純隨機產生的區塊常常有多組解（9×9 幾乎每次都是）。所以會反覆求解：每找到一組「非預期的解」，就把那組解用到、但正確解沒用到的某一格改判給隔壁區塊。這一格不會是任何一個正解位置，所以正解永遠存活，而那組雜解立刻失效。重複到只剩唯一解為止。

產完再丟給 `analyze.js` 評級，照難度曲線分配到 100 個關卡位置。整個流程跑一次約 60 秒：

```bash
node tools/generate-levels.mjs   # 重產 src/levels.js
node tools/verify-levels.mjs     # 驗證
```

驗證會檢查每一關的區塊連通性、四條規則、唯一解、**純邏輯可解**、**記錄的難度等級與解題器一致**、以及**難度不會倒退**；另外抽驗 30 題隨機盤面。

## 想加新主角？

在 `src/mascots.js` 的陣列裡加一筆就好：

```js
{
  id: 'duck',
  name: '鴨子',
  unit: '隻',          // 量詞，會用在「同一列有兩隻鴨子」
  accent: '#d9a33c',   // 主色
  svg: `<svg class="mascot" viewBox="0 0 64 64">…</svg>`,
  mark: `<svg viewBox="0 0 24 24">…</svg>`,  // 選填：換掉叉叉的圖示
}
```

主圖要在手機上約 34px 還看得清楚，所以線條粗一點、細節少一點。`mark` 會鋪滿大半個盤面而且是半透明的，所以要畫成**單色剪影**（不指定 `fill`，會自動套用深淺色模式的顏色），不然縮小之後會糊成一團。盤面顏色在 `styles.css` 最上面的 `--rg0` ~ `--rg9`。

## 授權

MIT，見 [LICENSE](LICENSE)。
