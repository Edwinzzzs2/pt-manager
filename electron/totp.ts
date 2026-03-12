import { createHmac } from 'node:crypto'

function base32ToBuffer(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const clean = String(input).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

function extractOtpAuthParams(input: string) {
  const raw = String(input || '').trim()
  if (!raw) return null
  if (raw.startsWith('otpauth://')) {
    try {
      const u = new URL(raw)
      const secret = u.searchParams.get('secret') || ''
      const digits = Number(u.searchParams.get('digits') || '6')
      const period = Number(u.searchParams.get('period') || '30')
      const algorithm = (u.searchParams.get('algorithm') || 'SHA1').toUpperCase()
      return { secret, digits, period, algorithm }
    } catch {
      return null
    }
  }
  if (raw.includes('secret=')) {
    try {
      const u = new URL(raw.includes('://') ? raw : `https://local.invalid/?${raw.replace(/^[?#]/, '')}`)
      const secret = u.searchParams.get('secret') || ''
      const digits = Number(u.searchParams.get('digits') || '6')
      const period = Number(u.searchParams.get('period') || '30')
      const algorithm = (u.searchParams.get('algorithm') || 'SHA1').toUpperCase()
      return { secret, digits, period, algorithm }
    } catch {
      return null
    }
  }
  return null
}

function secretToKey(input: string) {
  const raw = String(input || '').trim().replace(/\s+/g, '')
  if (!raw) return Buffer.alloc(0)
  if (/^[0-9a-f]+$/i.test(raw) && raw.length % 2 === 0) {
    try { return Buffer.from(raw, 'hex') } catch {}
  }
  const b32 = base32ToBuffer(raw)
  if (b32.length) return b32
  try {
    const b64 = Buffer.from(raw, 'base64')
    if (b64.length) return b64
  } catch {}
  return Buffer.from(raw, 'utf8')
}

export function generateTotp(secretInput: string, digits = 6, period = 30) {
  const params = extractOtpAuthParams(secretInput)
  const secret = params?.secret ?? secretInput
  const d = Number.isFinite(params?.digits) ? (params!.digits || digits) : digits
  const p = Number.isFinite(params?.period) ? (params!.period || period) : period
  const algo = (params?.algorithm || 'SHA1').toLowerCase()

  const key = secretToKey(secret)
  if (!key.length) return ''

  const counter = BigInt(Math.floor(Date.now() / 1000 / p))
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(counter, 0)

  const hmac = createHmac(algo as any, key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** d)
    .toString()
    .padStart(d, '0')
  return code
}
