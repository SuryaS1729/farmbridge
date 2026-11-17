import { RiArrowLeftLine } from '@remixicon/react'
import { Link, useParams } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { apiRequest, getErrorMessage } from '@/lib/api'
import { formatDateForIndia, formatPrice, formatSubmittedAt } from '@/lib/format'

type FarmerProfile = {
  userId: string
  phoneNumber: string | null
  signedUpAt: string
  aadhaarName: string | null
  village: string | null
  mandal: string | null
  farmSizeAcres: string | null
  cocoaTreeCount: number | null
  onboardedAt: string | null
}

type FarmerAddress = {
  id: string
  label: string
  address: string
  isDefault: boolean
  createdAt: string
}

type QuoteStatus = 'pending' | 'invalid_needs_revision' | 'accepted' | 'rejected' | 'withdrawn' | 'expired'

type FarmerQuote = {
  id: string
  offeredPricePerKg: string
  basePricePerKg: string
  quantityKg: string
  quantityQuintals: string
  moisturePercent: string
  beanCountPer100g: string
  readyOn: string
  pickupLocation: string | null
  status: QuoteStatus
  rejectionReason: string | null
  submittedAt: string
  dealId: string | null
  dealStatus: 'open' | 'completed' | 'cancelled' | null
  acceptedAt: string | null
  dealPickupLocation: string | null
  pickupScheduledOn: string | null
  collectedOn: string | null
  collectedWeightKg: string | null
  collectedWeightQuintals: string | null
}

type FarmerDetail = {
  farmer: FarmerProfile
  addresses: FarmerAddress[]
  quotes: FarmerQuote[]
}

const statusLabels: Record<QuoteStatus, string> = {
  pending: 'Pending review',
  invalid_needs_revision: 'Needs revision',
  accepted: 'Accepted',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

function StatusBadge({ status }: { status: QuoteStatus }) {
  const variant =
    status === 'accepted'
      ? 'default'
      : status === 'rejected' || status === 'invalid_needs_revision'
        ? 'destructive'
        : status === 'pending'
          ? 'secondary'
          : 'outline'
  return <Badge variant={variant}>{statusLabels[status]}</Badge>
}

/** Sums kg values exactly (3 decimals) and returns quintals for display. */
function totalCollectedQuintals(quotes: FarmerQuote[]) {
  const grams = quotes.reduce((total, quote) => {
    if (!quote.collectedWeightKg) return total
    const [whole, fraction = ''] = quote.collectedWeightKg.split('.')
    return total + BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0').slice(0, 3))
  }, 0n)
  const centiQuintals = grams / 1000n // 1 quintal = 100 kg, so 0.01 qtl = 1 kg
  return formatPrice(`${centiQuintals / 100n}.${(centiQuintals % 100n).toString().padStart(2, '0')}`)
}

function formatPhone(phone: string | null) {
  if (!phone) return '—'
  const digits = phone.replace(/\D/g, '').slice(-10)
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2 text-xs last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border bg-background p-3">
      <span className="text-[10px] font-medium tracking-widest text-muted-foreground">{label}</span>
      <span className="font-heading text-xl tabular-nums">{value}</span>
    </div>
  )
}

export function FarmerDetailPage() {
  const { farmerId } = useParams({ from: '/farmers/$farmerId' })
  const [detail, setDetail] = useState<FarmerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDetail = useCallback(async () => {
    try {
      const data = await apiRequest<FarmerDetail>(`/api/admin/farmers/${encodeURIComponent(farmerId)}`)
      setDetail(data)
      setError(null)
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setLoading(false)
    }
  }, [farmerId])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail])

  function retry() {
    setLoading(true)
    setError(null)
    void fetchDetail()
  }

  const farmer = detail?.farmer
  const quotes = detail?.quotes ?? []
  const addresses = detail?.addresses ?? []
  const dealCount = quotes.filter((quote) => quote.dealId).length
  const collectedCount = quotes.filter((quote) => quote.collectedOn).length

  return (
    <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
      <Link
        to="/farmers"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <RiArrowLeftLine className="size-3.5" aria-hidden />
        All farmers
      </Link>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-xs text-muted-foreground">
          Loading farmer…
        </div>
      ) : error || !farmer ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {error ?? 'Farmer not found.'}
            <Button size="xs" variant="outline" onClick={retry}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground">FARMER · COCOA</p>
              <h1 className="font-heading text-2xl">
                {farmer.aadhaarName ?? formatPhone(farmer.phoneNumber)}
              </h1>
              <p className="text-xs text-muted-foreground tabular-nums">
                {formatPhone(farmer.phoneNumber)}
                {farmer.village ? ` · ${farmer.village}` : ''}
                {farmer.mandal ? `, ${farmer.mandal} mandal` : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {farmer.onboardedAt ? (
                <Badge variant="outline">Onboarded {formatSubmittedAt(farmer.onboardedAt).split(' · ')[0]}</Badge>
              ) : (
                <Badge variant="secondary">Details missing</Badge>
              )}
              <Badge variant="outline" className="tabular-nums">
                Signed up {formatSubmittedAt(farmer.signedUpAt).split(' · ')[0]}
              </Badge>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="QUOTES" value={String(quotes.length)} />
            <Stat label="DEALS" value={String(dealCount)} />
            <Stat label="COLLECTIONS" value={String(collectedCount)} />
            <Stat label="COLLECTED · QTL" value={totalCollectedQuintals(quotes)} />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card>
              <CardHeader>
                <p className="text-[10px] font-medium tracking-widest text-muted-foreground">ONBOARDING</p>
                <CardTitle className="text-lg">Farm details</CardTitle>
                <CardDescription>As entered by the farmer in the app.</CardDescription>
              </CardHeader>
              <CardContent>
                <dl>
                  <DetailRow label="Name (as on Aadhaar)" value={farmer.aadhaarName ?? '—'} />
                  <DetailRow label="Contact number" value={formatPhone(farmer.phoneNumber)} />
                  <DetailRow label="Village" value={farmer.village ?? '—'} />
                  <DetailRow label="Mandal" value={farmer.mandal ?? '—'} />
                  <DetailRow
                    label="Cocoa farm size"
                    value={farmer.farmSizeAcres ? `${formatPrice(farmer.farmSizeAcres)} acres` : '—'}
                  />
                  <DetailRow
                    label="Total cocoa trees"
                    value={farmer.cocoaTreeCount?.toLocaleString('en-IN') ?? '—'}
                  />
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <p className="text-[10px] font-medium tracking-widest text-muted-foreground">PICKUP</p>
                <CardTitle className="text-lg">Saved addresses</CardTitle>
                <CardDescription>
                  The farmer picks one of these for each quote. The default is preselected in the app.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {addresses.length === 0 ? (
                  <div className="flex min-h-20 items-center justify-center border border-dashed text-xs text-muted-foreground">
                    No saved addresses yet.
                  </div>
                ) : (
                  <ul className="grid gap-3">
                    {addresses.map((address) => (
                      <li key={address.id} className="grid gap-1 border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium">{address.label}</span>
                          {address.isDefault ? <Badge variant="outline">Default</Badge> : null}
                        </div>
                        <p className="text-xs whitespace-pre-line text-muted-foreground">{address.address}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground">HISTORY</p>
              <CardTitle className="text-lg">Quotes and deals</CardTitle>
              <CardDescription>Newest first. The latest 200 quotes are shown.</CardDescription>
            </CardHeader>
            <CardContent>
              {quotes.length === 0 ? (
                <div className="flex min-h-24 items-center justify-center border border-dashed text-xs text-muted-foreground">
                  This farmer hasn’t submitted a quote yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Offer / kg</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Moisture · Beans</TableHead>
                      <TableHead>Ready</TableHead>
                      <TableHead>Pickup address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Deal progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {quotes.map((quote) => {
                      const pickup = quote.dealPickupLocation ?? quote.pickupLocation
                      return (
                        <TableRow key={quote.id}>
                          <TableCell className="tabular-nums">{formatSubmittedAt(quote.submittedAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className="font-medium">₹{quote.offeredPricePerKg}</span>
                            <span className="block text-[10px] text-muted-foreground">
                              Base ₹{formatPrice(quote.basePricePerKg)}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{quote.quantityQuintals} qtl</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {quote.moisturePercent}% · {quote.beanCountPer100g}
                          </TableCell>
                          <TableCell className="tabular-nums">{formatDateForIndia(quote.readyOn)}</TableCell>
                          <TableCell className="max-w-64 min-w-44 whitespace-normal">
                            {pickup ?? <span className="text-muted-foreground">Not provided</span>}
                            {quote.dealPickupLocation &&
                            quote.pickupLocation &&
                            quote.dealPickupLocation !== quote.pickupLocation ? (
                              <span className="block text-[10px] text-muted-foreground">Changed after acceptance</span>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={quote.status} />
                            {quote.status === 'rejected' && quote.rejectionReason ? (
                              <span className="mt-1 block max-w-48 text-[10px] whitespace-normal text-muted-foreground">
                                {quote.rejectionReason}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-[11px] whitespace-normal">
                            {quote.dealId ? (
                              <div className="grid gap-0.5 tabular-nums">
                                <span className="capitalize">{quote.dealStatus}</span>
                                <span className="text-muted-foreground">
                                  Pickup:{' '}
                                  {quote.pickupScheduledOn ? formatDateForIndia(quote.pickupScheduledOn) : 'not scheduled'}
                                </span>
                                <span className="text-muted-foreground">
                                  {quote.collectedOn && quote.collectedWeightQuintals
                                    ? `Collected ${quote.collectedWeightQuintals} qtl on ${formatDateForIndia(quote.collectedOn)}`
                                    : 'Not collected'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
