import { RiArrowDownSLine } from '@remixicon/react'
import { useEffect, useState } from 'react'
import './App.css'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'

type AdminSession = {
  user: {
    id: string
    phoneNumber?: string | null
    phoneNumberVerified?: boolean
    role?: string
  }
} | null

type DailyPrice = {
  businessDate: string
  basePricePerKg: string
  basePricePerQuintal: string
  currency: string
}

type TodayPrice = {
  businessDate: string
  price: DailyPrice | null
}

type OfferFilter = 'open' | 'pending' | 'invalid_needs_revision'

type AdminOffer = {
  id: string
  farmerPhoneNumber: string | null
  offeredPricePerKg: string
  basePricePerKg: string
  quantityKg: string
  quantityQuintals: string
  moisturePercent: string
  beanCountPer100g: string
  readyOn: string
  status: 'pending' | 'invalid_needs_revision'
  submittedAt: string
  expiresAt: string
}

type AdminDeal = {
  id: string
  farmerPhoneNumber: string | null
  offeredPricePerKg: string
  quantityQuintals: string
  moisturePercent: string
  beanCountPer100g: string
  readyOn: string
  status: 'open' | 'completed' | 'cancelled'
  acceptedAt: string
  pickupLocation: string | null
  pickupScheduledOn: string | null
  collectedOn: string | null
  collectedWeightKg: string | null
  collectedWeightQuintals: string | null
}

type CollectionForm = {
  collectedOn: string
  quantity: string
  quantityUnit: 'quintal' | 'kg'
}

type OfferQueue = {
  status: OfferFilter
  limit: number
  offers: AdminOffer[]
}

type OfferFilters = {
  minOfferedPricePerKg: string
  maxOfferedPricePerKg: string
  minQuantityQuintals: string
  maxQuantityQuintals: string
  minMoisturePercent: string
  maxMoisturePercent: string
  minBeanCountPer100g: string
  maxBeanCountPer100g: string
  readyFrom: string
  readyTo: string
}

const emptyOfferFilters: OfferFilters = {
  minOfferedPricePerKg: '',
  maxOfferedPricePerKg: '',
  minQuantityQuintals: '',
  maxQuantityQuintals: '',
  minMoisturePercent: '',
  maxMoisturePercent: '',
  minBeanCountPer100g: '',
  maxBeanCountPer100g: '',
  readyFrom: '',
  readyTo: '',
}

const offerFilterOptions: Record<OfferFilter, string> = {
  open: 'Open quotes',
  pending: 'Pending review',
  invalid_needs_revision: 'Needs price revision',
}

// Each pair renders as a "minimum / maximum" row in the filter panel.
const offerFilterFields: ReadonlyArray<{
  key: keyof OfferFilters
  label: string
  date?: boolean
}> = [
  { key: 'minOfferedPricePerKg', label: 'Minimum offer price · ₹/kg' },
  { key: 'maxOfferedPricePerKg', label: 'Maximum offer price · ₹/kg' },
  { key: 'minQuantityQuintals', label: 'Minimum quantity · quintals' },
  { key: 'maxQuantityQuintals', label: 'Maximum quantity · quintals' },
  { key: 'minMoisturePercent', label: 'Minimum moisture · %' },
  { key: 'maxMoisturePercent', label: 'Maximum moisture · %' },
  { key: 'minBeanCountPer100g', label: 'Minimum bean count · per 100 g' },
  { key: 'maxBeanCountPer100g', label: 'Maximum bean count · per 100 g' },
  { key: 'readyFrom', label: 'Ready on or after', date: true },
  { key: 'readyTo', label: 'Ready on or before', date: true },
]

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ?? 'http://localhost:8787'
).replace(/\/$/, '')
const INITIAL_PHONE_NUMBER = '+919491234567'

async function apiRequest<T>(
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

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Something went wrong. Please try again.'
}

function formatPrice(value: string) {
  const [whole, fraction = ''] = value.split('.')
  const trimmedFraction = fraction.replace(/0+$/, '')
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole
}

function formatSubmittedAt(value: string) {
  const date = new Date(value)
  const dateParts: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)) {
    dateParts[part.type] = part.value
  }
  const time = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
  return formatDateForIndia(dateParts.year + '-' + dateParts.month + '-' + dateParts.day) + ' · ' + time
}

function formatDateForIndia(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return match ? match[3] + '-' + match[2] + '-' + match[1] : value
}

function indianDateToIso(value: string) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value)
  if (!match) return null
  const isoDate = match[3] + '-' + match[2] + '-' + match[1]
  const parsed = new Date(isoDate + 'T00:00:00.000Z')
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === isoDate
    ? isoDate
    : null
}

function App() {
  const [phoneNumber, setPhoneNumber] = useState(INITIAL_PHONE_NUMBER)
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [session, setSession] = useState<AdminSession>(null)
  const [today, setToday] = useState<TodayPrice | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('open')
  const [offerFilters, setOfferFilters] = useState<OfferFilters>(emptyOfferFilters)
  const [offers, setOffers] = useState<AdminOffer[]>([])
  const [deals, setDeals] = useState<AdminDeal[]>([])
  const [pickupInputs, setPickupInputs] = useState<Record<string, string>>({})
  const [pickupDealId, setPickupDealId] = useState<string | null>(null)
  const [pickupEditingDealId, setPickupEditingDealId] = useState<string | null>(null)
  const [collectionEditingDealId, setCollectionEditingDealId] = useState<string | null>(null)
  const [collectionForm, setCollectionForm] = useState<CollectionForm>({ collectedOn: '', quantity: '', quantityUnit: 'quintal' })
  const [collectionSavingDealId, setCollectionSavingDealId] = useState<string | null>(null)
  const [dealError, setDealError] = useState<string | null>(null)
  const [decisionOfferId, setDecisionOfferId] = useState<string | null>(null)
  const [acceptingOffer, setAcceptingOffer] = useState<AdminOffer | null>(null)
  const [rejectingOffer, setRejectingOffer] = useState<AdminOffer | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const [loadingOffers, setLoadingOffers] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)

  async function loadDashboard() {
    const data = await apiRequest<TodayPrice>('/api/prices/today')
    setToday(data)
    setPriceInput(data.price?.basePricePerQuintal ?? '')
  }

  async function loadOffers(
    status: OfferFilter = offerFilter,
    filters: OfferFilters = offerFilters,
  ) {
    setLoadingOffers(true)
    setOfferError(null)
    try {
      const params = new URLSearchParams({ status })
      for (const [key, value] of Object.entries(filters)) {
        if (!value.trim()) continue
        if (key === 'readyFrom' || key === 'readyTo') {
          const isoDate = indianDateToIso(value.trim())
          if (!isoDate) {
            setOfferError('Enter filter dates in DD-MM-YYYY format.')
            return
          }
          params.set(key, isoDate)
        } else {
          params.set(key, value.trim())
        }
      }
      const data = await apiRequest<OfferQueue>('/api/admin/offers?' + params.toString())
      setOffers(data.offers)
    } catch (requestError) {
      setOfferError(getErrorMessage(requestError))
    } finally {
      setLoadingOffers(false)
    }
  }

  async function loadDeals() {
    const data = await apiRequest<{ deals: AdminDeal[] }>('/api/admin/deals')
    setDeals(data.deals)
  }

  async function schedulePickupDate(deal: AdminDeal) {
    const enteredDate = pickupInputs[deal.id] ?? (deal.pickupScheduledOn ? formatDateForIndia(deal.pickupScheduledOn) : '')
    const pickupScheduledOn = indianDateToIso(enteredDate.trim())
    if (!pickupScheduledOn) {
      setDealError('Enter the pickup date in DD-MM-YYYY format.')
      return
    }
    setPickupDealId(deal.id)
    setDealError(null)
    try {
      await apiRequest(`/api/admin/deals/${deal.id}/pickup-date`, {
        method: 'POST',
        body: { pickupScheduledOn },
      })
      await loadDeals()
      setPickupEditingDealId(null)
      setNotice('Pickup date saved and shown in the farmer’s quote history.')
    } catch (requestError) {
      setDealError(getErrorMessage(requestError))
    } finally {
      setPickupDealId(null)
    }
  }

  function openCollectionEditor(deal: AdminDeal) {
    // Quintal entries allow two decimals; fall back to kg if the saved weight needs more precision.
    const quintals = deal.collectedWeightQuintals ?? ''
    const fitsQuintals = /^\d+(?:\.\d{1,2})?$/.test(quintals) || quintals === ''
    setCollectionForm({
      collectedOn: deal.collectedOn ? formatDateForIndia(deal.collectedOn) : '',
      quantity: fitsQuintals
        ? quintals
        : (deal.collectedWeightKg ?? '').replace(/\.?0+$/, ''),
      quantityUnit: fitsQuintals ? 'quintal' : 'kg',
    })
    setDealError(null)
    setCollectionEditingDealId(deal.id)
  }

  async function recordCollection(deal: AdminDeal) {
    const collectedOn = indianDateToIso(collectionForm.collectedOn.trim())
    if (!collectedOn) {
      setDealError('Enter the collection date in DD-MM-YYYY format.')
      return
    }
    const quantity = collectionForm.quantity.trim()
    if (!quantity) {
      setDealError('Enter the collected weight.')
      return
    }
    setCollectionSavingDealId(deal.id)
    setDealError(null)
    try {
      await apiRequest(`/api/admin/deals/${deal.id}/collection`, {
        method: 'POST',
        body: { collectedOn, quantity, quantityUnit: collectionForm.quantityUnit },
      })
      await loadDeals()
      setCollectionEditingDealId(null)
      setNotice('Collection recorded and shown in the farmer’s quote history.')
    } catch (requestError) {
      setDealError(getErrorMessage(requestError))
    } finally {
      setCollectionSavingDealId(null)
    }
  }

  async function acceptOffer(offer: AdminOffer) {
    setDecisionOfferId(offer.id)
    setDecisionError(null)
    try {
      await apiRequest(`/api/admin/offers/${offer.id}/accept`, { method: 'POST' })
      await Promise.all([loadOffers(), loadDeals()])
      setAcceptingOffer(null)
      setNotice('Quote accepted and deal created with the submitted terms.')
    } catch (requestError) {
      setDecisionError(getErrorMessage(requestError))
    } finally {
      setDecisionOfferId(null)
    }
  }

  async function rejectOffer(offer: AdminOffer) {
    const reason = rejectReason.trim()
    if (!reason) {
      setDecisionError('Enter a rejection reason. It is shown to the farmer and kept in the audit record.')
      return
    }
    setDecisionOfferId(offer.id)
    setDecisionError(null)
    try {
      await apiRequest(`/api/admin/offers/${offer.id}/reject`, {
        method: 'POST',
        body: { reason },
      })
      await loadOffers()
      setRejectingOffer(null)
      setNotice('Quote rejected and the reason recorded.')
    } catch (requestError) {
      setDecisionError(getErrorMessage(requestError))
    } finally {
      setDecisionOfferId(null)
    }
  }

  async function checkAdminSession() {
    const current = await apiRequest<AdminSession>('/api/auth/get-session')
    if (!current?.user.phoneNumberVerified) {
      setSession(null)
      return
    }

    await apiRequest<{ role: 'admin' }>('/api/admin/claim', { method: 'POST' })
    await Promise.all([loadDashboard(), loadOffers(), loadDeals()])
    setSession(current)
  }

  useEffect(() => {
    let active = true
    void checkAdminSession()
      .catch((sessionError) => {
        if (active) {
          setSession(null)
          setError(getErrorMessage(sessionError))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

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
      await checkAdminSession()
    } catch (requestError) {
      setSession(null)
      setOtpSent(false)
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  async function publishPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(priceInput)) {
      setError('Enter a price with up to two decimal places.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/admin/prices/today', {
        method: 'POST',
        body: { basePricePerQuintal: priceInput },
      })
      await Promise.all([loadDashboard(), loadOffers(), loadDeals()])
      setNotice('Today’s Cocoa price is published.')
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  const activeFilterCount = Object.values(offerFilters).filter((value) => value.trim() !== '').length

  async function applyOfferFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadOffers(offerFilter, offerFilters)
  }

  function clearOfferFilters() {
    setOfferFilters(emptyOfferFilters)
    void loadOffers(offerFilter, emptyOfferFilters)
  }

  async function signOut() {
    setBusy(true)
    setError(null)
    try {
      const result = await apiRequest<{ success: boolean }>(
        '/api/auth/sign-out',
        { method: 'POST', body: {} },
      )
      if (!result.success) {
        throw new Error('The API did not confirm sign-out.')
      }

      const remainingSession =
        await apiRequest<AdminSession>('/api/auth/get-session')
      if (remainingSession) {
        throw new Error('Your session is still active. Please try again.')
      }

      setSession(null)
      setToday(null)
      setOtpSent(false)
      setOtp('')
      setNotice(null)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <main className="loading-screen" aria-live="polite">
        <span className="loading-mark" aria-hidden="true">F</span>
        <p>Opening Farmbridge…</p>
      </main>
    )
  }

  if (session) {
    return (
      <main className="dashboard-shell">
        <header className="topbar">
          <a className="brand" href="/" aria-label="Farmbridge home">
            <span className="brand-mark" aria-hidden="true">F</span>
            <span>farmbridge</span>
          </a>
          <div className="topbar-actions">
            <span className="admin-chip"><span /> Administrator</span>
            <button className="text-button" onClick={signOut} disabled={busy}>
              Sign out
            </button>
          </div>
        </header>

        <section className="dashboard-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">PROCUREMENT · COCOA</p>
              <h1>Good morning.</h1>
              <p className="page-subtitle">
                Set the price farmers will see before they submit today’s quotes.
              </p>
            </div>
            <div className="date-pill">
              <span className="date-dot" />
              {today ? formatDateForIndia(today.businessDate) : 'Today · Asia/Kolkata'}
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="price-card">
              <div className="card-heading">
                <div>
                  <p className="eyebrow">DAILY BASE PRICE</p>
                  <h2>Today’s Cocoa price</h2>
                </div>
                <span className="cocoa-icon" aria-hidden="true">C</span>
              </div>

              <div className="current-price" aria-live="polite">
                {today?.price ? (
                  <>
                    <span className="currency">₹</span>
                    <span>{today.price.basePricePerQuintal}</span>
                    <span className="price-unit">/ quintal</span>
                  </>
                ) : (
                  <span className="empty-price">Not published yet</span>
                )}
              </div>

              <p className="card-copy">
                Enter the daily base price per quintal. The API converts it to
                the equivalent price per kg for the farmer app and quote checks.
              </p>

              <form className="price-form" onSubmit={publishPrice}>
                <label htmlFor="price">Daily base price <span>(INR per quintal)</span></label>
                <div className="price-input-wrap">
                  <span aria-hidden="true">₹</span>
                  <input
                    id="price"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 25000.00"
                    value={priceInput}
                    onChange={(event) => setPriceInput(event.target.value)}
                    aria-describedby="price-help"
                  />
                  <span className="input-unit">per quintal</span>
                </div>
                <p id="price-help" className="field-help">
                  Up to two decimal places. Publishing again updates today’s
                  price and records a revision.
                </p>
                <button className="primary-button" type="submit" disabled={busy}>
                  {busy ? 'Publishing…' : today?.price ? 'Update today’s price' : 'Publish today’s price'}
                  {!busy && <span aria-hidden="true">↗</span>}
                </button>
              </form>

              {error && <p className="message message-error" role="alert">{error}</p>}
              {notice && <p className="message message-success" role="status">{notice}</p>}
            </section>

            <aside className="side-column">
              <section className="info-card">
                <span className="info-icon" aria-hidden="true">↗</span>
                <p className="eyebrow">PRICE RULE</p>
                <h3>Farmers see the per‑kg equivalent</h3>
                <p>
                  Farmer offers are entered per kg. The API compares each offer
                  against this quintal price converted to kg. A price increase
                  flags affected pending offers for revision.
                </p>
              </section>
              <section className="session-card">
                <span className="session-icon" aria-hidden="true">✓</span>
                <div>
                  <p className="eyebrow">SIGNED IN AS ADMIN</p>
                  <strong>{session.user.phoneNumber ?? phoneNumber}</strong>
                  <span>Phone verified</span>
                </div>
              </section>
            </aside>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground">FARMER SUBMISSIONS</p>
              <CardTitle className="text-lg">Quote review queue</CardTitle>
              <CardDescription>
                Review the details farmers submitted. The newest 100 matching quotes are shown.
              </CardDescription>
              <CardAction>
                <Select
                  items={offerFilterOptions}
                  value={offerFilter}
                  onValueChange={(value) => {
                    if (!value) return
                    setOfferFilter(value)
                    void loadOffers(value)
                  }}
                >
                  <SelectTrigger aria-label="Show quotes" className="min-w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(offerFilterOptions) as OfferFilter[]).map((value) => (
                      <SelectItem key={value} value={value}>
                        {offerFilterOptions[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-4">

            <Collapsible className="border">
              <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium hover:bg-muted">
                <span>
                  Filter by price, quantity, quality, or ready date
                  {activeFilterCount > 0 ? (
                    <Badge variant="secondary" className="ml-2">{activeFilterCount} active</Badge>
                  ) : null}
                </span>
                <RiArrowDownSLine className="size-4 transition-transform in-data-[panel-open]:rotate-180" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <form className="grid gap-4 border-t p-3" onSubmit={applyOfferFilters}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {offerFilterFields.map((field) => (
                      <div key={field.key} className="grid gap-1.5">
                        <Label htmlFor={`filter-${field.key}`} className="text-muted-foreground">
                          {field.label}
                        </Label>
                        <Input
                          id={`filter-${field.key}`}
                          inputMode={field.date ? 'numeric' : 'decimal'}
                          maxLength={field.date ? 10 : undefined}
                          placeholder={field.date ? 'DD-MM-YYYY' : undefined}
                          value={offerFilters[field.key]}
                          onChange={(event) =>
                            setOfferFilters((current) => ({ ...current, [field.key]: event.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Apply filters</Button>
                    <Button type="button" size="sm" variant="outline" onClick={clearOfferFilters}>
                      Clear
                    </Button>
                  </div>
                </form>
              </CollapsibleContent>
            </Collapsible>

            {loadingOffers ? (
              <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
                Loading submitted quotes…
              </div>
            ) : offerError ? (
              <div className="flex min-h-32 items-center justify-center gap-3 border border-dashed text-xs text-destructive" role="alert">
                <span>{offerError}</span>
                <Button size="xs" variant="outline" onClick={() => void loadOffers()}>
                  Retry
                </Button>
              </div>
            ) : offers.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
                No quotes in this view yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer</TableHead>
                    <TableHead className="text-right">Offer / kg</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Moisture</TableHead>
                    <TableHead className="text-right">Beans / 100 g</TableHead>
                    <TableHead>Ready date</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <span className="sr-only">Decision</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell>
                        <span className="font-medium">{offer.farmerPhoneNumber ?? 'Unknown phone'}</span>
                        <span className="block text-[10px] text-muted-foreground">Verified farmer</span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="font-medium">₹{offer.offeredPricePerKg}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          Base ₹{formatPrice(offer.basePricePerKg)} / kg
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{offer.quantityQuintals} qtl</TableCell>
                      <TableCell className="text-right tabular-nums">{offer.moisturePercent}%</TableCell>
                      <TableCell className="text-right tabular-nums">{offer.beanCountPer100g}</TableCell>
                      <TableCell>{formatDateForIndia(offer.readyOn)}</TableCell>
                      <TableCell>{formatSubmittedAt(offer.submittedAt)}</TableCell>
                      <TableCell>
                        {offer.status === 'pending' ? (
                          <Badge variant="secondary">Pending review</Badge>
                        ) : (
                          <Badge variant="destructive">Needs revision</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div
                          className="flex flex-col items-stretch gap-1"
                          title={offer.status !== 'pending' ? 'Only pending quotes can be accepted' : undefined}
                        >
                          <Button
                            size="xs"
                            disabled={decisionOfferId !== null || offer.status !== 'pending'}
                            onClick={() => {
                              setDecisionError(null)
                              setAcceptingOffer(offer)
                            }}
                          >
                            Accept & create deal
                          </Button>
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={decisionOfferId !== null}
                            onClick={() => {
                              setDecisionError(null)
                              setRejectReason('')
                              setRejectingOffer(offer)
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="text-xs text-muted-foreground">
              Quantity is shown in quintals for every farmer. Moisture and bean count are self-reported.
              Acceptance creates a deal and locks the submitted price, quantity, quality details, and ready date.
            </p>
            </CardContent>
          </Card>

          <AlertDialog
            open={acceptingOffer !== null}
            onOpenChange={(open) => {
              if (!open && decisionOfferId === null) setAcceptingOffer(null)
            }}
          >
            <AlertDialogContent>
              {acceptingOffer ? (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Accept quote and create deal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      These terms from {acceptingOffer.farmerPhoneNumber ?? 'this farmer'} will be locked into the deal,
                      even if the base price changes later.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted px-3 py-2 text-xs">
                    <dt className="text-muted-foreground">Price</dt>
                    <dd className="text-right tabular-nums">₹{acceptingOffer.offeredPricePerKg} / kg</dd>
                    <dt className="text-muted-foreground">Quantity</dt>
                    <dd className="text-right tabular-nums">{acceptingOffer.quantityQuintals} quintals</dd>
                    <dt className="text-muted-foreground">Moisture</dt>
                    <dd className="text-right tabular-nums">{acceptingOffer.moisturePercent}%</dd>
                    <dt className="text-muted-foreground">Bean count</dt>
                    <dd className="text-right tabular-nums">{acceptingOffer.beanCountPer100g} per 100 g</dd>
                    <dt className="text-muted-foreground">Ready date</dt>
                    <dd className="text-right tabular-nums">{formatDateForIndia(acceptingOffer.readyOn)}</dd>
                  </dl>
                  {decisionError ? <p className="text-xs text-destructive" role="alert">{decisionError}</p> : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={decisionOfferId !== null}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={decisionOfferId !== null}
                      onClick={() => void acceptOffer(acceptingOffer)}
                    >
                      {decisionOfferId === acceptingOffer.id ? 'Accepting…' : 'Accept & create deal'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              ) : null}
            </AlertDialogContent>
          </AlertDialog>

          <Dialog
            open={rejectingOffer !== null}
            onOpenChange={(open) => {
              if (!open && decisionOfferId === null) setRejectingOffer(null)
            }}
          >
            <DialogContent className="sm:max-w-md">
              {rejectingOffer ? (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void rejectOffer(rejectingOffer)
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>Reject quote</DialogTitle>
                    <DialogDescription>
                      Quote from {rejectingOffer.farmerPhoneNumber ?? 'this farmer'}: ₹{rejectingOffer.offeredPricePerKg} / kg
                      for {rejectingOffer.quantityQuintals} quintals. The farmer sees your reason in My quotes.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-2">
                    <Label htmlFor="reject-reason">Reason</Label>
                    <Textarea
                      id="reject-reason"
                      rows={3}
                      placeholder="For example: moisture is too high for this week's buying."
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                    />
                  </div>
                  {decisionError ? <p className="text-xs text-destructive" role="alert">{decisionError}</p> : null}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" disabled={decisionOfferId !== null} />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit" variant="destructive" disabled={decisionOfferId !== null}>
                      {decisionOfferId === rejectingOffer.id ? 'Rejecting…' : 'Reject quote'}
                    </Button>
                  </DialogFooter>
                </form>
              ) : null}
            </DialogContent>
          </Dialog>

          <Card className="mt-6">
            <CardHeader>
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground">ACCEPTED QUOTES</p>
              <CardTitle className="text-lg">Deals</CardTitle>
              <CardDescription>The newest 100 deals, with terms copied from the accepted quote.</CardDescription>
            </CardHeader>
            <CardContent>
              {deals.length === 0 ? (
                <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
                  No deals have been created yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Farmer</TableHead>
                      <TableHead className="text-right">Price / kg</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Moisture</TableHead>
                      <TableHead className="text-right">Beans / 100 g</TableHead>
                      <TableHead>Accepted</TableHead>
                      <TableHead>Pickup location</TableHead>
                      <TableHead>Scheduled pickup</TableHead>
                      <TableHead>Collected</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deals.map((deal) => {
                      const canAct = Boolean(deal.pickupLocation) && deal.status === 'open'
                      const blockedReason = !deal.pickupLocation
                        ? 'Waiting for farmer to share a pickup location'
                        : deal.status !== 'open'
                          ? 'This deal is no longer open'
                          : undefined
                      return (
                        <TableRow key={deal.id}>
                          <TableCell className="font-medium">{deal.farmerPhoneNumber ?? 'Unknown phone'}</TableCell>
                          <TableCell className="text-right tabular-nums">₹{deal.offeredPricePerKg}</TableCell>
                          <TableCell className="text-right tabular-nums">{deal.quantityQuintals} qtl</TableCell>
                          <TableCell className="text-right tabular-nums">{deal.moisturePercent}%</TableCell>
                          <TableCell className="text-right tabular-nums">{deal.beanCountPer100g}</TableCell>
                          <TableCell>{formatSubmittedAt(deal.acceptedAt)}</TableCell>
                          <TableCell className="max-w-72 min-w-52 whitespace-normal">
                            {deal.pickupLocation ?? (
                              <span className="text-muted-foreground">Waiting for farmer to share location</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {deal.pickupScheduledOn ? (
                              formatDateForIndia(deal.pickupScheduledOn)
                            ) : (
                              <span className="text-muted-foreground">Not scheduled</span>
                            )}
                            <span className="block text-[10px] text-muted-foreground">
                              Farmer ready: {formatDateForIndia(deal.readyOn)}
                            </span>
                          </TableCell>
                          <TableCell>
                            {deal.collectedOn && deal.collectedWeightQuintals ? (
                              <>
                                {deal.collectedWeightQuintals} qtl
                                <span className="block text-[10px] text-muted-foreground">
                                  On {formatDateForIndia(deal.collectedOn)}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not collected</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col items-stretch gap-1" title={blockedReason}>
                              <Button
                                size="xs"
                                variant="outline"
                                disabled={!canAct}
                                onClick={() => {
                                  setPickupEditingDealId(deal.id)
                                  setPickupInputs((current) => ({
                                    ...current,
                                    [deal.id]: current[deal.id] ?? (deal.pickupScheduledOn ? formatDateForIndia(deal.pickupScheduledOn) : ''),
                                  }))
                                  setDealError(null)
                                }}
                              >
                                {deal.pickupScheduledOn ? 'Reschedule pickup' : 'Schedule pickup'}
                              </Button>
                              <Button
                                size="xs"
                                variant={deal.collectedOn ? 'outline' : 'default'}
                                disabled={!canAct}
                                onClick={() => openCollectionEditor(deal)}
                              >
                                {deal.collectedOn ? 'Edit collection' : 'Record collection'}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
              {dealError && !pickupEditingDealId && !collectionEditingDealId ? (
                <p className="mt-3 text-xs text-destructive" role="alert">{dealError}</p>
              ) : null}
            </CardContent>
          </Card>
        </section>
        <Dialog
          open={pickupEditingDealId !== null}
          onOpenChange={(open) => {
            if (!open) setPickupEditingDealId(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            {(() => {
              const deal = deals.find((item) => item.id === pickupEditingDealId)
              if (!deal) return null
              return (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void schedulePickupDate(deal)
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{deal.pickupScheduledOn ? 'Reschedule pickup' : 'Schedule pickup'}</DialogTitle>
                    <DialogDescription>
                      Set the date for the driver to collect cocoa from {deal.farmerPhoneNumber ?? 'this farmer'}.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="bg-muted px-3 py-2 text-xs whitespace-pre-wrap">
                    <strong>Pickup location:</strong> {deal.pickupLocation}
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="pickup-scheduled-on">
                      Pickup date <span className="text-muted-foreground">(DD-MM-YYYY)</span>
                    </Label>
                    <Input
                      id="pickup-scheduled-on"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="DD-MM-YYYY"
                      value={pickupInputs[deal.id] ?? (deal.pickupScheduledOn ? formatDateForIndia(deal.pickupScheduledOn) : '')}
                      onChange={(event) => setPickupInputs((current) => ({ ...current, [deal.id]: event.target.value }))}
                    />
                  </div>
                  {dealError ? <p className="text-xs text-destructive" role="alert">{dealError}</p> : null}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={pickupDealId !== null}>
                      {pickupDealId === deal.id ? 'Saving…' : deal.pickupScheduledOn ? 'Save new pickup date' : 'Save pickup date'}
                    </Button>
                  </DialogFooter>
                </form>
              )
            })()}
          </DialogContent>
        </Dialog>
        <Dialog
          open={collectionEditingDealId !== null}
          onOpenChange={(open) => {
            if (!open) setCollectionEditingDealId(null)
          }}
        >
          <DialogContent className="sm:max-w-md">
            {(() => {
              const deal = deals.find((item) => item.id === collectionEditingDealId)
              if (!deal) return null
              return (
                <form
                  className="grid gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void recordCollection(deal)
                  }}
                >
                  <DialogHeader>
                    <DialogTitle>{deal.collectedOn ? 'Edit collection' : 'Record collection'}</DialogTitle>
                    <DialogDescription>
                      Record the date the driver collected cocoa from {deal.farmerPhoneNumber ?? 'this farmer'} and the weight on the scale.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="bg-muted px-3 py-2 text-xs">
                    <strong>Accepted quote quantity:</strong> {deal.quantityQuintals} quintals
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="collected-on">
                      Collection date <span className="text-muted-foreground">(DD-MM-YYYY)</span>
                    </Label>
                    <Input
                      id="collected-on"
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="DD-MM-YYYY"
                      value={collectionForm.collectedOn}
                      onChange={(event) => setCollectionForm((current) => ({ ...current, collectedOn: event.target.value }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="collected-weight">
                      Collected weight{' '}
                      <span className="text-muted-foreground">
                        ({collectionForm.quantityUnit === 'quintal' ? 'quintals' : 'kg'})
                      </span>
                    </Label>
                    <div className="flex gap-1" role="group" aria-label="Weight unit">
                      {(['quintal', 'kg'] as const).map((unit) => (
                        <Button
                          key={unit}
                          type="button"
                          size="sm"
                          variant={collectionForm.quantityUnit === unit ? 'default' : 'outline'}
                          aria-pressed={collectionForm.quantityUnit === unit}
                          onClick={() => setCollectionForm((current) => ({ ...current, quantityUnit: unit }))}
                        >
                          {unit === 'quintal' ? 'Quintals' : 'Kg'}
                        </Button>
                      ))}
                    </div>
                    <Input
                      id="collected-weight"
                      inputMode="decimal"
                      placeholder={collectionForm.quantityUnit === 'quintal' ? 'e.g. 12.5' : 'e.g. 1250'}
                      value={collectionForm.quantity}
                      onChange={(event) => setCollectionForm((current) => ({ ...current, quantity: event.target.value }))}
                    />
                  </div>
                  {dealError ? <p className="text-xs text-destructive" role="alert">{dealError}</p> : null}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={collectionSavingDealId !== null}>
                      {collectionSavingDealId === deal.id ? 'Saving…' : deal.collectedOn ? 'Save changes' : 'Save collection'}
                    </Button>
                  </DialogFooter>
                </form>
              )
            })()}
          </DialogContent>
        </Dialog>
        <footer className="dashboard-footer">
          <span>FARMBRIDGE ADMIN</span>
          <span>Local development · Asia/Kolkata</span>
        </footer>
      </main>
    )
  }

  return (
    <main className="login-shell">
      <aside className="login-story">
        <a className="brand brand-light" href="/" aria-label="Farmbridge home">
          <span className="brand-mark" aria-hidden="true">F</span>
          <span>farmbridge</span>
        </a>
        <div className="story-copy">
          <p className="eyebrow">COCOA PROCUREMENT</p>
          <h1>Good work starts with a fair price.</h1>
          <p>
            Publish the day’s Cocoa base price and give every farmer a clear
            place to begin.
          </p>
        </div>
        <div className="story-bottom">
          <div className="story-stat"><strong>01</strong><span>Daily price</span></div>
          <div className="story-divider" />
          <div className="story-stat"><strong>INR</strong><span>Price per quintal</span></div>
        </div>
      </aside>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand brand">
            <span className="brand-mark" aria-hidden="true">F</span>
            <span>farmbridge</span>
          </div>
          <p className="eyebrow">ADMIN ACCESS</p>
          <h2>{otpSent ? 'Check your phone.' : 'Welcome back.'}</h2>
          <p className="login-subtitle">
            {otpSent
              ? 'Enter the six-digit verification code to continue.'
              : 'Sign in to publish today’s Cocoa base price.'}
          </p>

          {otpSent ? (
            <form className="login-form" onSubmit={verifyOtp}>
              <label htmlFor="otp">Verification code</label>
              <input
                id="otp"
                className="otp-input"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
                autoFocus
              />
              <p className="field-help">
                Local development codes are printed in the API terminal.
              </p>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Verifying…' : 'Verify and continue'}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
              <button
                className="back-button"
                type="button"
                onClick={() => {
                  setOtpSent(false)
                  setOtp('')
                  setError(null)
                  setNotice(null)
                }}
              >
                Use a different number
              </button>
            </form>
          ) : (
            <form className="login-form" onSubmit={sendOtp}>
              <label htmlFor="phone">Admin mobile number</label>
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                placeholder="+919491234567"
                required
              />
              <p className="field-help">
                Use the phone number authorized for the administrator account.
              </p>
              <button className="primary-button" type="submit" disabled={busy}>
                {busy ? 'Sending code…' : 'Send one-time code'}
                {!busy && <span aria-hidden="true">→</span>}
              </button>
            </form>
          )}

          {error && <p className="message message-error" role="alert">{error}</p>}
          {notice && <p className="message message-success" role="status">{notice}</p>}
          <p className="login-footnote">
            Access is limited to the server-authorized administrator phone.
          </p>
        </div>
      </section>
    </main>
  )
}

export default App
