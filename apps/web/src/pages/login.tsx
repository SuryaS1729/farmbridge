import { REGEXP_ONLY_DIGITS } from 'input-otp'
import { useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Label } from '@/components/ui/label'
import { apiRequest, getErrorMessage } from '@/lib/api'

const INITIAL_PHONE_NUMBER = '+919491234567'

export function LoginPage({
  onSignedIn,
  initialError,
}: {
  /** Re-checks the session after the code is verified; throws if not allowed. */
  onSignedIn: () => Promise<void>
  initialError?: string | null
}) {
  const [phoneNumber, setPhoneNumber] = useState(INITIAL_PHONE_NUMBER)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [notice, setNotice] = useState<string | null>(null)

  async function sendOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!/^\+\d{10,15}$/.test(phoneNumber.trim())) {
      setError('Enter the admin phone number in international format.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/auth/phone-number/send-otp', {
        method: 'POST',
        body: { phoneNumber: phoneNumber.trim() },
      })
      setOtp('')
      setOtpSent(true)
      setNotice('One-time code sent. In local development, check the API terminal.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter the six-digit code from the API terminal.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/auth/phone-number/verify', {
        method: 'POST',
        body: { phoneNumber: phoneNumber.trim(), code: otp },
      })
      await onSignedIn()
    } catch (requestError) {
      setOtpSent(false)
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="grid min-h-screen bg-background lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <a className="flex items-center gap-2 font-heading text-sm" href="/" aria-label="Farmbridge home">
          <span className="flex size-7 items-center justify-center bg-primary-foreground text-xs text-primary" aria-hidden="true">
            F
          </span>
          <span>farmbridge</span>
        </a>
        <div className="grid max-w-md gap-4">
          <p className="text-[10px] font-medium tracking-widest opacity-70">COCOA PROCUREMENT</p>
          <h1 className="font-heading text-4xl/tight">Good work starts with a fair price.</h1>
          <p className="text-sm/relaxed opacity-80">
            Publish the day’s Cocoa base price and give every farmer a clear
            place to begin.
          </p>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="grid gap-1">
            <strong className="font-heading text-lg">01</strong>
            <span className="opacity-70">Daily price</span>
          </div>
          <div className="h-10 w-px bg-primary-foreground/20" />
          <div className="grid gap-1">
            <strong className="font-heading text-lg">INR</strong>
            <span className="opacity-70">Price per quintal</span>
          </div>
        </div>
      </aside>

      <section className="relative flex items-center justify-center p-4 sm:p-8">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-4 flex items-center gap-2 font-heading text-sm lg:hidden">
              <span className="flex size-7 items-center justify-center bg-primary text-xs text-primary-foreground" aria-hidden="true">
                F
              </span>
              <span>farmbridge</span>
            </div>
            <p className="text-[10px] font-medium tracking-widest text-muted-foreground">ADMIN ACCESS</p>
            <CardTitle className="text-xl">{otpSent ? 'Check your phone.' : 'Welcome back.'}</CardTitle>
            <CardDescription>
              {otpSent
                ? 'Enter the six-digit verification code to continue.'
                : 'Sign in to publish today’s Cocoa base price.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {otpSent ? (
              <form className="grid gap-3" onSubmit={verifyOtp}>
                <Label htmlFor="otp">Verification code</Label>
                <InputOTP
                  id="otp"
                  maxLength={6}
                  pattern={REGEXP_ONLY_DIGITS}
                  value={otp}
                  onChange={setOtp}
                  autoFocus
                >
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
                <p className="text-[11px] text-muted-foreground">
                  Local development codes are printed in the API terminal.
                </p>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Verifying…' : 'Verify and continue'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOtpSent(false)
                    setOtp('')
                    setError(null)
                    setNotice(null)
                  }}
                >
                  Use a different number
                </Button>
              </form>
            ) : (
              <form className="grid gap-3" onSubmit={sendOtp}>
                <Label htmlFor="phone">Admin mobile number</Label>
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  placeholder="+919491234567"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Use the phone number authorized for the administrator account.
                </p>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Sending code…' : 'Send one-time code'}
                </Button>
              </form>
            )}

            {error ? (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {notice ? (
              <Alert role="status">
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
          <CardFooter>
            <p className="text-[11px] text-muted-foreground">
              Access is limited to the server-authorized administrator phone.
            </p>
          </CardFooter>
        </Card>
      </section>
    </main>
  )
}
