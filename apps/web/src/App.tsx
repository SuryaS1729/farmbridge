import { useEffect, useState } from 'react'
import './App.css'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

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
    if (!window.confirm(`Accept this quote from ${offer.farmerPhoneNumber ?? 'this farmer'} and create a deal? The submitted terms will be locked.`)) return
    setDecisionOfferId(offer.id)
    setOfferError(null)
    try {
      await apiRequest(`/api/admin/offers/${offer.id}/accept`, { method: 'POST' })
      await Promise.all([loadOffers(), loadDeals()])
      setNotice('Quote accepted and deal created with the submitted terms.')
    } catch (requestError) {
      setOfferError(getErrorMessage(requestError))
    } finally {
      setDecisionOfferId(null)
    }
  }

  async function rejectOffer(offer: AdminOffer) {
    const reason = window.prompt('Why are you rejecting this quote? A reason is required for the audit record.')
    if (reason === null) return
    if (!reason.trim()) {
      setOfferError('Enter a rejection reason before rejecting the quote.')
      return
    }
    setDecisionOfferId(offer.id)
    setOfferError(null)
    try {
      await apiRequest(`/api/admin/offers/${offer.id}/reject`, {
        method: 'POST',
        body: { reason: reason.trim() },
      })
      await loadOffers()
      setNotice('Quote rejected and the reason recorded.')
    } catch (requestError) {
      setOfferError(getErrorMessage(requestError))
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

          <section className="offers-card">
            <div className="offers-heading">
              <div>
                <p className="eyebrow">FARMER SUBMISSIONS</p>
                <h2>Quote review queue</h2>
                <p className="offers-subtitle">
                  Review the details farmers submitted. The newest 100 matching quotes are shown.
                </p>
              </div>
              <label className="offer-filter">
                <span>SHOW</span>
                <select
                  value={offerFilter}
                  onChange={(event) => {
                    const nextFilter = event.target.value as OfferFilter
                    setOfferFilter(nextFilter)
                    void loadOffers(nextFilter)
                  }}
                >
                  <option value="open">Open quotes</option>
                  <option value="pending">Pending review</option>
                  <option value="invalid_needs_revision">Needs price revision</option>
                </select>
              </label>
            </div>

            <details className="offer-filter-details">
              <summary>Filter by price, quantity, quality, or ready date</summary>
              <form className="offer-filter-form" onSubmit={applyOfferFilters}>
                <div className="offer-filter-grid">
                  <label>
                    Minimum offer price · ₹/kg
                    <input
                      inputMode="decimal"
                      value={offerFilters.minOfferedPricePerKg}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          minOfferedPricePerKg: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Maximum offer price · ₹/kg
                    <input
                      inputMode="decimal"
                      value={offerFilters.maxOfferedPricePerKg}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          maxOfferedPricePerKg: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Minimum quantity · quintals
                    <input
                      inputMode="decimal"
                      value={offerFilters.minQuantityQuintals}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          minQuantityQuintals: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Maximum quantity · quintals
                    <input
                      inputMode="decimal"
                      value={offerFilters.maxQuantityQuintals}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          maxQuantityQuintals: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Minimum moisture · %
                    <input
                      inputMode="decimal"
                      value={offerFilters.minMoisturePercent}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          minMoisturePercent: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Maximum moisture · %
                    <input
                      inputMode="decimal"
                      value={offerFilters.maxMoisturePercent}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          maxMoisturePercent: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Minimum bean count · per 100 g
                    <input
                      inputMode="decimal"
                      value={offerFilters.minBeanCountPer100g}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          minBeanCountPer100g: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Maximum bean count · per 100 g
                    <input
                      inputMode="decimal"
                      value={offerFilters.maxBeanCountPer100g}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          maxBeanCountPer100g: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Ready on or after
                    <input
                      inputMode="numeric"
                      placeholder="DD-MM-YYYY"
                      value={offerFilters.readyFrom}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          readyFrom: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label>
                    Ready on or before
                    <input
                      inputMode="numeric"
                      placeholder="DD-MM-YYYY"
                      value={offerFilters.readyTo}
                      onChange={(event) =>
                        setOfferFilters((current) => ({
                          ...current,
                          readyTo: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="offer-filter-actions">
                  <button type="submit" className="filter-apply-button">
                    Apply filters
                  </button>
                  <button type="button" className="filter-clear-button" onClick={clearOfferFilters}>
                    Clear
                  </button>
                </div>
              </form>
            </details>

            {loadingOffers ? (
              <div className="offers-state">Loading submitted quotes…</div>
            ) : offerError ? (
              <div className="offers-state offers-error" role="alert">
                <span>{offerError}</span>
                <button className="text-button" onClick={() => void loadOffers()}>
                  Retry
                </button>
              </div>
            ) : offers.length === 0 ? (
              <div className="offers-state">
                No quotes in this view yet.
              </div>
            ) : (
              <div className="offers-table-scroll">
                <table className="offers-table">
                  <thead>
                    <tr>
                      <th scope="col">FARMER</th>
                      <th scope="col">OFFER / KG</th>
                      <th scope="col">QUANTITY</th>
                      <th scope="col">MOISTURE</th>
                      <th scope="col">BEANS / 100 G</th>
                      <th scope="col">READY DATE</th>
                      <th scope="col">SUBMITTED</th>
                      <th scope="col">STATUS</th>
                      <th scope="col">DECISION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.id}>
                        <td className="farmer-cell">
                          <strong>{offer.farmerPhoneNumber ?? 'Unknown phone'}</strong>
                          <span>Verified farmer</span>
                        </td>
                        <td className="offer-price-cell">
                          <strong>₹{offer.offeredPricePerKg}</strong>
                          <span>Base ₹{formatPrice(offer.basePricePerKg)} / kg</span>
                        </td>
                        <td className="quantity-cell">
                          <strong>{offer.quantityQuintals}</strong>
                          <span>quintals</span>
                        </td>
                        <td>{offer.moisturePercent}%</td>
                        <td>{offer.beanCountPer100g}</td>
                        <td>{formatDateForIndia(offer.readyOn)}</td>
                        <td>{formatSubmittedAt(offer.submittedAt)}</td>
                        <td>
                          <span className={`offer-status offer-status-${offer.status}`}>
                            {offer.status === 'pending' ? 'Pending review' : 'Needs revision'}
                          </span>
                        </td>
                        <td className="offer-actions-cell">
                          <button
                            className="offer-accept-button"
                            disabled={decisionOfferId !== null || offer.status !== 'pending'}
                            onClick={() => void acceptOffer(offer)}
                          >
                            {decisionOfferId === offer.id ? 'Saving…' : 'Accept & create deal'}
                          </button>
                          <button
                            className="offer-reject-button"
                            disabled={decisionOfferId !== null}
                            onClick={() => void rejectOffer(offer)}
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="offers-footnote">
              Quantity is shown in quintals for every farmer. Moisture and bean count are self-reported.
              Acceptance creates a deal and locks the submitted price, quantity, quality details, and ready date.
            </p>
          </section>

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
