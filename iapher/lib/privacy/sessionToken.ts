import jwt from 'jsonwebtoken'

const SECRET = process.env.SESSION_SECRET!

export function signSessionToken(sessionId: string): string {
  return jwt.sign({ sessionId }, SECRET, { expiresIn: '7d' })
}

export function verifySessionToken(token: string): { sessionId: string } | null {
  try {
    return jwt.verify(token, SECRET) as { sessionId: string }
  } catch {
    return null
  }
}
