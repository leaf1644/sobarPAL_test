# SoberPal 待辦

依 `artifacts/SoberPal-architecture.md` 與 `soberpal-app-builder/SKILL.md` 的建造順序。一次做一項，做完再進下一項。

必備閉環只有兩次打開：出門前設定守護者與預計到家時間；之後按 I'm home，否則守護者收到錯過回報。加酒、喝水提醒、Focus Check 都是可選。

## 做的時候不能破

- 只有「錯過回家回報」可以自動當成危險。杯數、Focus Check、略過提醒都不算。
- 介面寫「至少記了 N 杯」，不能暗示已記完全部。
- Focus Check 無及格／不及格，不通知守護者，不是酒測或駕駛判斷。
- 位置只在守護者已接受的今晚時段內分享；時段結束就停。
- 飲酒中用規則計時，不呼叫聊天模型。
- 文案不羞辱；每次記錄都可復原。
- 守護者通知與杯數公式分開，不能混用，也不能用「還剩幾杯」鎖功能。

```
Guardian alert  := active AND now > check_in_at + grace AND NOT home
logged_at_least := sum(drink.count where not undone)
```

## 0. 專案骨架（兩台電腦的網頁 demo）

- [x] 客戶端：Vite + React + TypeScript，一台電腦一個瀏覽器
- [x] SparseLog 留在飲酒者的瀏覽器
- [x] 薄後端：建立今晚時段、守護者邀請、兩邊都讀得到的狀態、錯過回報
- [x] Watchdog cron：飲酒者關掉瀏覽器時，超過寬限且沒有到家事件，仍把時段標成 missed
- [x] 守護者在第二台電腦用 magic link 加入，不必安裝 App
- [x] 三個畫面的空殼：Plan tonight、Tonight、Guardian mode
- [x] Demo 的狀態顯示在兩邊網頁上。FCM / APNs 與本機通知留到第 7 項

## 1. Tonight session

- [x] 出門前規劃：個人上限（personal_limit_serves）、預計到家時間（check_in_at）、標記 Guardian
- [x] 預設寬限 grace_minutes = 10
- [x] 狀態：planned | active | home | missed | cancelled
- [x] 欄位先留好：share_location、primary_drink_type、meds_warning_ack
- [x] 更換 Guardian 必須再確認
- [ ] 規劃全程目標 ≤ 60 秒

## 2. I'm home 與錯過回報

- [x] Tonight 畫面的 I'm home，按了就結束時段並停止分享位置
- [x] 超過 check_in_at + grace 且尚未到家：第二台電腦的守護者頁面看到錯過回報
- [x] 飲酒者看到常駐的「你還好嗎？」
- [x] 之後最多每 20 分鐘再提醒一次
- [x] Guardian 畫面：名字、回報狀態、最後一次 ping、Call
- [x] 預設不把飲酒日記給守護者看
- [x] 位置預設只在錯過時分享最後一次 ping，不是完整軌跡

## 3. 一鍵記錄

- [x] + Drink、+ Water
- [x] 可一次 +2（batch）
- [x] 撤銷留在該行，不限 30 秒（時鐘參數與「減一杯」見第 8 項）
- [x] 顯示「至少記了 N」，N 只算未復原的 drink.count
- [x] log_event：kind（drink | water | pause | home | extend）、count、source、undone
- [ ] 點擊目標 ≥ 48 dp；解鎖後一鍵 ≤ 2 秒
- [x] 桌面小工具與手錶的 source 先在資料模型留位，介面留到第 7 項

## 4. SessionWatch 安靜提醒

- [x] 網頁 demo 用頁面上的計時規則，只看 check_in_at、時段狀態、nudge 政策
- [x] 不讀 Focus Check 結果，不讀杯數
- [x] 喝水提醒最多每 45 分鐘一次
- [x] 到家前 10 分鐘「要回家了嗎？」只問一次
- [x] 今晚可以關掉這些提醒
- [x] 略過提醒不等於失敗；nudge 最多每 30 分鐘一個
- [x] 飲酒中不呼叫雲端語言模型

## 5. Focus Check

- [x] 三個小遊戲：反應點擊、配對、邏輯「下一個是什麼」
- [x] 一輪約 30 秒，可選
- [x] 玩完回到回報選項（+ Drink、Focus Check、I'm home），沒有分數門檻
- [x] 文案寫明：只是暫停一下，不是酒測，也不是駕駛安全測試
- [x] 結果不進守護者通知，也不進危險判斷

## 6. 服藥警示

- [x] 只在規劃今晚時顯示，不在派對途中呼叫 PlanAssist
- [x] 靜態的藥物–酒精警示與拒絕說法
- [x] 需使用者確認（meds_warning_ack）才寫進時段

## 7. 網頁 demo 做完才做（Android 與 iOS）

- [ ] 手機客戶端二選一：Flutter 或 React Native
- [ ] 本機 SQLite，給 SparseLog 用
- [ ] 推播用 FCM / APNs；喝水與 nudge 用本機通知
- [ ] 鎖定畫面／桌面小工具 +1
- [ ] 手錶 complication
- [ ] 對應 log source：widget、watch

## 8. 代碼結構（審查後要收）

行為保持不變。一次做一項，做完再進下一項。

- [x] 今晚頁與規劃頁共用「更換守護者」元件。今晚頁拆開紀錄、提醒、到家；輪詢與記下提醒不要和按鈕寫在同一個函數。抽完後兩邊都要有「取消更換」（目前只在規劃頁）
- [x] `src/server/api.ts` 的 `dispatch` 收成一個寫入包裝：改 store、watchdog tick、再回傳快照與 `server_now`。讀取只 tick 再回傳。`advance` 與 `jump` 走同一個包裝，跳完時間的回應帶上新狀態
- [x] 刪除永遠為真、而且忽略參數的包裝：`actionsOpen`、`imHomeAllowed`、`requestHome` 裡走不到的拋錯、`checkInStatusLabel`（畫面直接用 `statusLabel`）、`FOCUS_DISCLAIMER`（畫面直接用 `copy.focusDisclaimer`）。保留 `completeFocusRound`。測試改為斷言「返到屋企」仍在，專注結果沒有及格欄位
- [x] 領域層與 API 只交狀態與名字，不交已翻譯的句子。`toGuardianView` 不再帶 `check_in_status`、`call_label`。錯誤用穩定代碼，畫面用 `src/copy.ts` 對成句子。`loggedAtLeastCopy`、`nudgeCopy` 的組句移到畫面
- [x] 撤銷已不限時，刪掉 `canUndo`、`tryUndo`、`sparseLog.undo` 的 `nowMs`。分組列上的撤銷改為減一杯；現在撤的是最新一筆事件，該筆若是 +2，畫面上的總數會一次少 2

## 隱私與資料保留

- [x] 飲酒清單在網頁 demo 預設留在飲酒者的瀏覽器；手機階段留在裝置。同步要飲酒者自己打開
- [x] 時段相關資料短保留後刪除（例如 7 天）
- [x] 時段結束即停止分享位置

## v1 明確不做

- 每杯拍照、雲端辨識酒杯
- 用估計血液酒精濃度決定能不能離開或開車
- 必須先通過小遊戲才能按 I'm home
- Focus Check 失敗就通知守護者
- 強制每一杯都要記錄
- 全天候家人追蹤
- 公開飲酒排行榜或社群動態
- 飲酒中的聊天機器人
