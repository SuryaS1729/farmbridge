export type AdminSession = {
  user: {
    id: string
    phoneNumber?: string | null
    phoneNumberVerified?: boolean
    role?: string
  }
} | null

export const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
).replace(/\/$/, '')

export async function apiRequest<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = (await response.json().catch(() => null)) as
    | { error?: string | { message?: string } }
    | T
    | null

  if (!response.ok) {
    const errorValue =
      payload && typeof payload === 'object' && 'error' in payload
        ? payload.error
        : null
    const message =
      typeof errorValue === 'string'
        ? errorValue
        : errorValue?.message ?? 'The request could not be completed.'
    throw new Error(message)
  }

  return payload as T
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}
