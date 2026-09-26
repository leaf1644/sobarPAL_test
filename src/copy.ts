import type { SessionStatus } from './domain/types'

/** Every sentence the drinker or guardian can read. Spoken Hong Kong Cantonese. */
export const copy = {
  brand: '清醒夥伴',
  tagline: '出街玩得開心，有人掛住你返屋企。',
  navPlan: '創建行程',
  navTonight: '記酒器',
  navFocus: '停一停',
  navGuardian: '睇住朋友',
  legend: '可以記低飲咗一杯、停一停，或者話我返到屋企。',
  themeToLight: '淺色',
  themeToDark: '深色',
  navLabel: '畫面',

  planEyebrow: '未出門',
  planTitle: '創建行程',
  planLede: '講定邊個睇住你、大約幾點返到。另一部電腦開條連結就得。飲咗幾多唔會傳過去。',
  yourName: '你叫咩名',
  guardian: '邊個睇住你',
  limit: '今晚想飲幾多',
  limitHint: '提醒吓啫，唔會鎖住你。',
  drink: '主要飲咩',
  beer: '啤酒',
  wine: '葡萄酒',
  spirits: '烈酒',
  other: '其他',
  homeTime: '大約幾點返到',
  shareLocation: '對方接咗先分享你最後打低嘅一個位置，唔記成條路線。',
  medsTitle: '食緊藥？',
  refusalTitle: '唔想飲可以咁講',
  medsAck: '我睇過呢啲提醒喇',
  create: '創建行程',
  statusPrefix: '而家',
  linkHint: '將條連結開喺另一部電腦。',
  linkLabel: '條連結',
  openTonight: '去記酒器',
  swapLabel: '換人睇住',
  swapButton: '換人睇住',
  cancelSwap: '算啦',
  confirmSwapButton: '係，換佢',

  tonightEyebrow: '而家',
  tonightTitle: '記酒器',
  needPlan: '未創建行程就未記到。先去「創建行程」。',
  waiting: '等緊對方接',
  connected: '已經接咗',
  limitShort: '想飲',
  cups: '杯',
  logHint: '呢個係你記低咗嘅，唔代表飲晒咁多。想飲幾多都唔會鎖住個掣。',
  drinkOne: '飲多一杯',
  drinkTwo: '飲多兩杯',
  water: '飲啖水',
  focus: '停一停',
  home: '返到屋企',
  notNow: '遲啲先',
  dismiss: '今晚唔使再提',
  undo: '撤銷',
  undone: '撤銷咗',
  nudgeWater: '飲啖水？',
  nudgeHeading: '準備返屋企？',
  areYouOk: '你沒事呀？',
  pingLabel: '而家喺邊',
  pingPlaceholder: '港鐵 B 出口',
  pingButton: '話佢知我喺邊',
  pingHint: '只留呢一次，唔會變成路線。',
  clockHint: '示範時鐘。兩部電腦用同一個時間。',
  plusFifteen: '快轉十五分鐘',
  pastGrace: '快轉到過咗點',
  cancelTonight: '取消記酒器',

  focusEyebrow: '停一停',
  focusTitle: '抖一抖。',
  focusDisclaimer: '停低喘口氣啫，唔係測你醉唔醉，亦唔係話你可唔可以開車。',
  focusNote: '大概三十秒。想玩就玩，冇分數。',
  gamesLabel: '小遊戲',
  gameReaction: '反應',
  gameMatch: '搵一樣',
  gameLogic: '下一款係咩',
  pauseDone: '停完喇。',
  backTonight: '返去記酒器',
  reactionHint: '個目標出嚟先好撳。',
  start: '開始',
  waitTarget: '等陣，目標未出。',
  tap: '撳呢度',
  matchHint: '搵個同上面一樣嘅。',
  logicHint: '估下一款係咩。',
  circle: '圓形',
  square: '方形',
  triangle: '三角形',

  guardianEyebrow: '朋友',
  guardianTitle: '睇住朋友',
  guardianEmpty: '用飲酒者俾你嘅連結開呢版。你睇唔到佢飲咗幾多。',
  loading: '開緊邀請…',
  noPing: '未有分享位置。',
  accept: '我睇住',
  lastPing: '最後位置',
  lastReminder: '上次提你',

  errCreate: '創建唔到行程',
  errSwap: '換唔到',
  errConfirm: '確認唔到',
  errLoad: '載入唔到記酒器',
  errUndo: '撤銷唔到',
  errHome: '報唔到返到',
  errPing: '分享唔到位置',
  errClock: '調唔到時間',
  errCancel: '取消唔到',
  errOpen: '開唔到邀請',
  errAccept: '接唔到',
  errNeedPlan: '先創建行程先',
  errConfirmRequired: '請先確認更換',
  needChecks: '兩項都要勾，先創建到行程。',

  medsWarnings: [
    '有啲藥同酒一齊用，容易瞓、容易流血，肝臟亦辛苦啲。提醒嚟㗎咋，唔係診斷。',
    '唔肯定嘅話，今晚唔飲得，或者先問藥劑師、醫生。',
  ],
  refusalScripts: ['我今晚食緊藥，所以唔飲酒。', '我飲水得喇。', '下次先陪你哋飲。'],
} as const

export function loggedLine(count: number): string {
  return `至少記低咗 ${count} 杯`
}

export function nudgeText(kind: 'water' | 'heading_home'): string {
  return kind === 'water' ? copy.nudgeWater : copy.nudgeHeading
}

export function errorText(code: string, fallback: string): string {
  switch (code) {
    case 'confirm_required':
      return copy.errConfirmRequired
    case 'location_not_shared':
    case 'ping_label_required':
      return copy.errPing
    case 'already_home':
      return copy.errHome
    case 'session_ended':
      return copy.errCancel
    case 'minutes_invalid':
      return copy.errClock
    default:
      return fallback
  }
}

export function graceLine(minutes: number): string {
  return `遲過約定時間 ${minutes} 分鐘都未撳「${copy.home}」，睇住你嗰個就知你未報到。`
}

export function confirmSwapLine(name: string): string {
  return `換成${name}？`
}

export function lookingAfter(name: string): string {
  return `睇住緊 ${name}`
}

export function callLabel(name: string): string {
  return `打俾${name}`
}

export function missedLine(name: string): string {
  return `${name}未報到。有分享位置嘅話，喺下面。`
}

export function callingLine(name: string): string {
  return `而家打俾${name}。呢個示範唔會真係打電話。`
}

export function statusLabel(status: SessionStatus): string {
  switch (status) {
    case 'planned':
      return '未出發'
    case 'active':
      return '出緊街'
    case 'home':
      return '返到咗'
    case 'missed':
      return '未報到'
    case 'cancelled':
      return '取消咗'
  }
}

export function shapeWord(name: string): string {
  switch (name) {
    case 'circle':
      return copy.circle
    case 'square':
      return copy.square
    case 'triangle':
      return copy.triangle
    default:
      return name
  }
}

export function drinkWord(value: string): string {
  switch (value) {
    case 'beer':
      return copy.beer
    case 'wine':
      return copy.wine
    case 'spirits':
      return copy.spirits
    case 'other':
      return copy.other
    default:
      return value
  }
}

export function logWord(kind: string): string {
  switch (kind) {
    case 'drink':
      return '酒'
    case 'water':
      return '水'
    case 'pause':
      return '停'
    case 'home':
      return '返到'
    case 'extend':
      return '延長'
    default:
      return kind
  }
}
