import bcrypt from 'bcryptjs'

const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12')

export async function hashPhone(phone: string): Promise<string> {
  const normalized = phone.replace(/\D/g, '')
  return bcrypt.hash(normalized, ROUNDS)
}

export async function verifyPhone(phone: string, hash: string): Promise<boolean> {
  const normalized = phone.replace(/\D/g, '')
  return bcrypt.compare(normalized, hash)
}
