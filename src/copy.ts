export function drinkTypeLabel(value: string): string {
  switch (value) {
    case 'beer':
      return '啤酒'
    case 'wine':
      return '葡萄酒'
    case 'spirits':
      return '烈酒'
    case 'other':
      return '其他'
    default:
      return value
  }
}

export function logKindLabel(kind: string): string {
  switch (kind) {
    case 'drink':
      return '酒'
    case 'water':
      return '喝水'
    case 'pause':
      return '暫停'
    case 'home':
      return '到家'
    case 'extend':
      return '延長'
    default:
      return kind
  }
}

export function shapeLabel(name: string): string {
  switch (name) {
    case 'circle':
      return '圓形'
    case 'square':
      return '方形'
    case 'triangle':
      return '三角形'
    default:
      return name
  }
}
