export class DomainError extends Error {
  readonly status: number
  readonly code: string

  constructor(code: string, status = 400) {
    super(code)
    this.name = 'DomainError'
    this.status = status
    this.code = code
  }
}
