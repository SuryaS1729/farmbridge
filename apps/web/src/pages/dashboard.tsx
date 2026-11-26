import { CaretDownIcon } from '@phosphor-icons/react'
import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useState } from 'react'
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
import { DatePicker } from '@/components/date-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
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
import { useAdminAuth } from '@/lib/admin-auth'
import { apiRequest, getErrorMessage } from '@/lib/api'
import { queryKeys } from '@/lib/queries'
import {
  formatDateForIndia,
  formatPrice,
  formatSubmittedAt,
  indianDateToIso,
} from '@/lib/format'

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
  farmerName: string | null
  farmerVillage: string | null
  farmerMandal: string | null
  farmerFarmSizeAcres: string | null
  farmerCocoaTreeCount: number | null
  offeredPricePerKg: string
  basePricePerKg: string
  quantityKg: string
  quantityQuintals: string
  moisturePercent: string
  beanCountPer100g: string
  readyOn: string
  pickupLocation: string | null
  status: 'pending' | 'invalid_needs_revision'
  submittedAt: string
  expiresAt: string
  updatedAt: string
}

type AdminDeal = {
  id: string
  farmerPhoneNumber: string | null
  farmerName: string | null
  farmerVillage: string | null
  farmerMandal: string | null
  farmerFarmSizeAcres: string | null
  farmerCocoaTreeCount: number | null
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

type FarmerDetails = Pick<
  AdminOffer,
  | 'farmerPhoneNumber'
  | 'farmerName'
  | 'farmerVillage'
  | 'farmerMandal'
  | 'farmerFarmSizeAcres'
  | 'farmerCocoaTreeCount'
>

function farmerLabel(farmer: FarmerDetails, fallback = 'this farmer') {
  return farmer.farmerName ?? farmer.farmerPhoneNumber ?? fallback
}

function FarmerCell({ farmer }: { farmer: FarmerDetails }) {
  const place = [farmer.farmerVillage, farmer.farmerMandal].filter(Boolean).join(', ')
  const farm =
    farmer.farmerFarmSizeAcres && farmer.farmerCocoaTreeCount
      ? `${formatPrice(farmer.farmerFarmSizeAcres)} ac · ${farmer.farmerCocoaTreeCount.toLocaleString('en-IN')} trees`
      : null
  return (
    <div className="min-w-44">
      <span className="font-medium">{farmer.farmerName ?? farmer.farmerPhoneNumber ?? 'Unknown farmer'}</span>
      {farmer.farmerName && farmer.farmerPhoneNumber ? (
        <span className="block text-[10px] text-muted-foreground tabular-nums">{farmer.farmerPhoneNumber}</span>
      ) : null}
      {place ? (
        <span className="block text-[10px] text-muted-foreground">{place}</span>
      ) : (
        <span className="block text-[10px] text-muted-foreground">Farm details not provided</span>
      )}
      {farm ? <span className="block text-[10px] text-muted-foreground tabular-nums">{farm}</span> : null}
    </div>
  )
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

type PriceUnit = 'quintal' | 'kg'

const pricePatterns: Record<PriceUnit, RegExp> = {
  quintal: /^\d{1,10}(?:\.\d{1,2})?$/,
  kg: /^\d{1,8}(?:\.\d{1,4})?$/,
}

// Convert with integer math so prices never pick up floating-point error.
// A 2-decimal quintal price is always an exact 4-decimal kg price (1 quintal = 100 kg).
function convertPriceInput(value: string, from: PriceUnit, to: PriceUnit) {
  if (from === to || !pricePatterns[from].test(value)) return value
  const [whole, fraction = ''] = value.split('.')
  if (to === 'kg') {
    const paisePerQuintal = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    return formatPrice(`${paisePerQuintal / 10_000n}.${(paisePerQuintal % 10_000n).toString().padStart(4, '0')}`)
  }
  const tenThousandthsPerKg = BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'))
  return formatPrice(`${tenThousandthsPerKg / 100n}.${(tenThousandthsPerKg % 100n).toString().padStart(2, '0')}`)
}

/** A valid price as integer paise per quintal (equal to ten-thousandths of a rupee per kg). */
function paisePerQuintal(value: string, unit: PriceUnit) {
  const [whole, fraction = ''] = value.split('.')
  return unit === 'quintal'
    ? BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
    : BigInt(whole) * 10_000n + BigInt(fraction.padEnd(4, '0'))
}

// A change this large from the current price gets an extra warning in the confirm dialog,
// to catch a slipped digit or the wrong unit before farmers see it.
const LARGE_PRICE_CHANGE_PERCENT = 10

type PriceConfirmation = {
  priceUnit: PriceUnit
  basePrice: string
  perQuintal: string
  perKg: string
  /** Change from the current published price, or null when nothing is published yet. */
  change: { perQuintal: string; percent: number } | null
}

function buildPriceConfirmation(
  basePrice: string,
  priceUnit: PriceUnit,
  current: DailyPrice | null | undefined,
): PriceConfirmation {
  let change: PriceConfirmation['change'] = null
  if (current) {
    const next = paisePerQuintal(basePrice, priceUnit)
    const previous = paisePerQuintal(current.basePricePerKg, 'kg')
    const diff = next - previous
    const abs = diff < 0n ? -diff : diff
    change = {
      perQuintal: `${diff < 0n ? '−' : '+'}${formatPrice(`${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`)}`,
      percent: previous === 0n ? Infinity : (Number(diff) / Number(previous)) * 100,
    }
  }
  return {
    priceUnit,
    basePrice,
    perQuintal: priceUnit === 'quintal' ? formatPrice(basePrice) : convertPriceInput(basePrice, 'kg', 'quintal'),
    perKg: priceUnit === 'kg' ? formatPrice(basePrice) : convertPriceInput(basePrice, 'quintal', 'kg'),
    change,
  }
}

/** Turns the filter form into API params, or explains which date is malformed. */
function buildOfferParams(
  filters: OfferFilters,
): { params: Record<string, string> } | { error: string } {
  const params: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (!value.trim()) continue
    if (key === 'readyFrom' || key === 'readyTo') {
      const isoDate = indianDateToIso(value.trim())
      if (!isoDate) return { error: 'Pick valid filter dates.' }
      params[key] = isoDate
    } else {
      params[key] = value.trim()
    }
  }
  return { params }
}

function priceInputFor(data: TodayPrice | undefined, unit: PriceUnit) {
  if (!data?.price) return ''
  return formatPrice(unit === 'kg' ? data.price.basePricePerKg : data.price.basePricePerQuintal)
}

// Shared by the page and the route loader, so a preload fills the same cache entries.
export const todayPriceQueryOptions = queryOptions({
  queryKey: queryKeys.todayPrice,
  queryFn: () => apiRequest<TodayPrice>('/api/prices/today'),
})

export const dealsQueryOptions = queryOptions({
  queryKey: queryKeys.deals,
  queryFn: () => apiRequest<{ deals: AdminDeal[] }>('/api/admin/deals'),
  // Farmers' actions change deals too; poll so the table stays current without a reload.
  // TanStack pauses polling while the browser tab is hidden.
  refetchInterval: 60_000,
})

export function offerQueueQueryOptions(status: OfferFilter, params: Record<string, string>) {
  return queryOptions({
    queryKey: queryKeys.offerQueue(status, params),
    queryFn: () =>
      apiRequest<OfferQueue>('/api/admin/offers?' + new URLSearchParams({ status, ...params }).toString()),
    // Farmers submit quotes at any time; poll so new ones appear without a reload.
    // TanStack pauses polling while the browser tab is hidden.
    refetchInterval: 30_000,
  })
}

/** What the dashboard shows on first open: open quotes, no filters. */
export const defaultOfferQueueQueryOptions = offerQueueQueryOptions('open', {})

export function DashboardPage() {
  const queryClient = useQueryClient()
  const { session } = useAdminAuth()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [priceInput, setPriceInput] = useState('')
  const [priceInputSeeded, setPriceInputSeeded] = useState(false)
  const [priceUnit, setPriceUnit] = useState<PriceUnit>('kg')
  const [confirmingPrice, setConfirmingPrice] = useState<PriceConfirmation | null>(null)
  const [priceConfirmError, setPriceConfirmError] = useState<string | null>(null)
  const [offerFilter, setOfferFilter] = useState<OfferFilter>('open')
  // `offerFilters` is the form being typed; `appliedOfferParams` is what the query uses.
  const [offerFilters, setOfferFilters] = useState<OfferFilters>(emptyOfferFilters)
  const [appliedOfferParams, setAppliedOfferParams] = useState<Record<string, string>>({})
  const [offerFilterError, setOfferFilterError] = useState<string | null>(null)
  const [pickupInputs, setPickupInputs] = useState<Record<string, string>>({})
  const [pickupEditingDealId, setPickupEditingDealId] = useState<string | null>(null)
  const [collectionEditingDealId, setCollectionEditingDealId] = useState<string | null>(null)
  const [collectionForm, setCollectionForm] = useState<CollectionForm>({ collectedOn: '', quantity: '', quantityUnit: 'quintal' })
  const [dealError, setDealError] = useState<string | null>(null)
  const [acceptingOffer, setAcceptingOffer] = useState<AdminOffer | null>(null)
  const [rejectingOffer, setRejectingOffer] = useState<AdminOffer | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [decisionError, setDecisionError] = useState<string | null>(null)
  const todayQuery = useQuery(todayPriceQueryOptions)
  const today = todayQuery.data ?? null

  // Fill the price input once from the first load only, so background refetches
  // never overwrite a price the admin is in the middle of typing.
  if (!priceInputSeeded && todayQuery.data) {
    setPriceInputSeeded(true)
    setPriceInput(priceInputFor(todayQuery.data, priceUnit))
  }

  const offersQuery = useQuery({
    ...offerQueueQueryOptions(offerFilter, appliedOfferParams),
    // Keep the current table on screen while a new status/filter loads, instead of flashing a spinner.
    placeholderData: keepPreviousData,
  })
  const offers = offersQuery.data?.offers ?? []
  const loadingOffers = offersQuery.isPending || (offersQuery.isError && offersQuery.isFetching)
  const offerError =
    offerFilterError ?? (offersQuery.isError ? getErrorMessage(offersQuery.error) : null)

  const dealsQuery = useQuery(dealsQueryOptions)
  const deals = dealsQuery.data?.deals ?? []

  const loadError = todayQuery.error ?? dealsQuery.error
  const pageError = error ?? (loadError ? getErrorMessage(loadError) : null)

  /** Marks data stale and waits for any on-screen queries to refetch. */
  function invalidate(...keys: QueryKey[]) {
    return Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
  }

  // Each mutation stays pending until the data it affects has refetched, so the table never
  // shows the old row after "Saving…" clears. ['farmers'] also covers every farmer detail page.
  const pickupMutation = useMutation({
    mutationFn: ({ dealId, pickupScheduledOn }: { dealId: string; pickupScheduledOn: string }) =>
      apiRequest(`/api/admin/deals/${dealId}/pickup-date`, { method: 'POST', body: { pickupScheduledOn } }),
    onSuccess: () => invalidate(queryKeys.deals, queryKeys.farmers),
  })

  const collectionMutation = useMutation({
    mutationFn: ({ dealId, ...body }: { dealId: string } & CollectionForm) =>
      apiRequest(`/api/admin/deals/${dealId}/collection`, { method: 'POST', body }),
    onSuccess: () => invalidate(queryKeys.deals, queryKeys.farmers),
  })

  const acceptMutation = useMutation({
    // updatedAt as shown on screen: the API refuses if the farmer revised the quote since.
    mutationFn: (offer: AdminOffer) =>
      apiRequest(`/api/admin/offers/${offer.id}/accept`, {
        method: 'POST',
        body: { expectedUpdatedAt: offer.updatedAt },
      }),
    onSuccess: () => invalidate(queryKeys.offers, queryKeys.deals, queryKeys.farmers),
    // A refused accept usually means the quote changed or expired: reload so the admin sees the latest.
    onError: () => invalidate(queryKeys.offers),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ offerId, reason }: { offerId: string; reason: string }) =>
      apiRequest(`/api/admin/offers/${offerId}/reject`, { method: 'POST', body: { reason } }),
    onSuccess: () => invalidate(queryKeys.offers, queryKeys.farmers),
  })

  const publishMutation = useMutation({
    mutationFn: (body: { priceUnit: PriceUnit; basePrice: string }) =>
      apiRequest('/api/admin/prices/today', { method: 'POST', body }),
    // A new price can flag pending quotes for revision, so offers and farmer histories change too.
    onSuccess: () => invalidate(queryKeys.todayPrice, queryKeys.offers, queryKeys.deals, queryKeys.farmers),
  })

  const deciding = acceptMutation.isPending || rejectMutation.isPending

  // Validation messages and API errors share one message slot per area, so the
  // handlers below use mutateAsync and route failures into that slot.
  async function schedulePickupDate(deal: AdminDeal) {
    const enteredDate = pickupInputs[deal.id] ?? (deal.pickupScheduledOn ? formatDateForIndia(deal.pickupScheduledOn) : '')
    const pickupScheduledOn = indianDateToIso(enteredDate.trim())
    if (!pickupScheduledOn) {
      setDealError('Pick the pickup date.')
      return
    }
    setDealError(null)
    try {
      await pickupMutation.mutateAsync({ dealId: deal.id, pickupScheduledOn })
      setPickupEditingDealId(null)
      setNotice('Pickup date saved and shown in the farmer’s quote history.')
    } catch (requestError) {
      setDealError(getErrorMessage(requestError))
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
      setDealError('Pick the collection date.')
      return
    }
    const quantity = collectionForm.quantity.trim()
    if (!quantity) {
      setDealError('Enter the collected weight.')
      return
    }
    setDealError(null)
    try {
      await collectionMutation.mutateAsync({
        dealId: deal.id,
        collectedOn,
        quantity,
        quantityUnit: collectionForm.quantityUnit,
      })
      setCollectionEditingDealId(null)
      setNotice('Collection recorded and shown in the farmer’s quote history.')
    } catch (requestError) {
      setDealError(getErrorMessage(requestError))
    }
  }

  async function acceptOffer(offer: AdminOffer) {
    setDecisionError(null)
    try {
      await acceptMutation.mutateAsync(offer)
      setAcceptingOffer(null)
      setNotice('Quote accepted and deal created with the submitted terms.')
    } catch (requestError) {
      setDecisionError(getErrorMessage(requestError))
      // The offers list has refetched by now (onError waits for it). Show the latest terms in
      // the dialog, so a quote the farmer just revised can be reviewed and accepted as it is now.
      const fresh = queryClient
        .getQueriesData<{ offers: AdminOffer[] }>({ queryKey: queryKeys.offers })
        .flatMap(([, data]) => data?.offers ?? [])
        .find((candidate) => candidate.id === offer.id)
      if (fresh) setAcceptingOffer(fresh)
    }
  }

  async function rejectOffer(offer: AdminOffer) {
    const reason = rejectReason.trim()
    if (!reason) {
      setDecisionError('Enter a rejection reason. It is shown to the farmer and kept in the audit record.')
      return
    }
    setDecisionError(null)
    try {
      await rejectMutation.mutateAsync({ offerId: offer.id, reason })
      setRejectingOffer(null)
      setNotice('Quote rejected and the reason recorded.')
    } catch (requestError) {
      setDecisionError(getErrorMessage(requestError))
    }
  }

  // Submitting the form only opens the confirm dialog; the price is sent from there.
  function reviewPrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    const basePrice = priceInput.trim()
    if (!pricePatterns[priceUnit].test(basePrice)) {
      setError(
        priceUnit === 'kg'
          ? 'Enter a kg price with up to four decimal places.'
          : 'Enter a quintal price with up to two decimal places.',
      )
      return
    }
    if (paisePerQuintal(basePrice, priceUnit) === 0n) {
      setError('Enter a base price above ₹0.')
      return
    }

    setPriceConfirmError(null)
    setConfirmingPrice(buildPriceConfirmation(basePrice, priceUnit, today?.price))
  }

  async function publishPrice(confirmation: PriceConfirmation) {
    setPriceConfirmError(null)
    try {
      await publishMutation.mutateAsync({ priceUnit: confirmation.priceUnit, basePrice: confirmation.basePrice })
      setConfirmingPrice(null)
      setPriceInput(priceInputFor(queryClient.getQueryData<TodayPrice>(queryKeys.todayPrice), priceUnit))
      setNotice('Today’s Cocoa price is published.')
    } catch (requestError) {
      setPriceConfirmError(getErrorMessage(requestError))
    }
  }

  const activeFilterCount = Object.values(offerFilters).filter((value) => value.trim() !== '').length

  function applyOfferFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const result = buildOfferParams(offerFilters)
    if ('error' in result) {
      setOfferFilterError(result.error)
      return
    }
    setOfferFilterError(null)
    // Same filters → same query key, so refetch explicitly to keep "Apply" meaning "reload".
    if (JSON.stringify(result.params) === JSON.stringify(appliedOfferParams)) {
      void offersQuery.refetch()
    } else {
      setAppliedOfferParams(result.params)
    }
  }

  function clearOfferFilters() {
    setOfferFilters(emptyOfferFilters)
    setOfferFilterError(null)
    setAppliedOfferParams({})
  }

  if (!session) return null

  return (
    <>
        <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="grid gap-1">
              <p className="text-[10px] font-medium tracking-widest text-muted-foreground">PROCUREMENT · COCOA</p>
              <h1 className="font-heading text-2xl">Good morning.</h1>
              <p className="text-xs text-muted-foreground">
                Set the price farmers will see before they submit today’s quotes.
              </p>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {today ? formatDateForIndia(today.businessDate) : 'Today · Asia/Kolkata'}
            </Badge>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,0.85fr)]">
            <Card>
              <CardHeader>
                <p className="text-[10px] font-medium tracking-widest text-muted-foreground">DAILY BASE PRICE</p>
                <CardTitle className="text-lg">Today’s Cocoa price</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div aria-live="polite">
                  {today?.price ? (
                    <p className="flex items-baseline gap-1 font-heading tabular-nums">
                      <span className="text-xl text-muted-foreground">₹</span>
                      <span className="text-4xl">
                        {priceUnit === 'kg' ? formatPrice(today.price.basePricePerKg) : today.price.basePricePerQuintal}
                      </span>
                      <span className="text-sm text-muted-foreground">/ {priceUnit === 'kg' ? 'kg' : 'quintal'}</span>
                    </p>
                  ) : (
                    <p className="font-heading text-2xl text-muted-foreground">Not published yet</p>
                  )}
                </div>

                <p className="text-xs/relaxed text-muted-foreground">
                  Enter the daily base price per kg or per quintal (1 quintal = 100 kg).
                  The API stores the per-kg price used by the farmer app and quote checks.
                </p>

                <form className="grid gap-2" onSubmit={reviewPrice}>
                  <Label htmlFor="price">
                    Daily base price{' '}
                    <span className="text-muted-foreground">(INR per {priceUnit === 'kg' ? 'kg' : 'quintal'})</span>
                  </Label>
                  <div className="flex gap-1" role="group" aria-label="Price unit">
                    {(['kg', 'quintal'] as const).map((unit) => (
                      <Button
                        key={unit}
                        type="button"
                        size="sm"
                        variant={priceUnit === unit ? 'default' : 'outline'}
                        aria-pressed={priceUnit === unit}
                        onClick={() => {
                          setPriceInput((current) => convertPriceInput(current, priceUnit, unit))
                          setPriceUnit(unit)
                        }}
                      >
                        {unit === 'quintal' ? 'Per quintal' : 'Per kg'}
                      </Button>
                    ))}
                  </div>
                  <InputGroup>
                    <InputGroupAddon>
                      <InputGroupText>₹</InputGroupText>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="price"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={priceUnit === 'kg' ? 'e.g. 250.00' : 'e.g. 25000.00'}
                      value={priceInput}
                      onChange={(event) => setPriceInput(event.target.value)}
                      aria-describedby="price-help"
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>per {priceUnit === 'kg' ? 'kg' : 'quintal'}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <p id="price-help" className="text-[11px] text-muted-foreground">
                    {priceUnit === 'kg' ? 'Up to four decimal places.' : 'Up to two decimal places.'} Publishing again updates today’s
                    price and records a revision.
                  </p>
                  <Button type="submit" className="mt-2 w-fit" disabled={publishMutation.isPending}>
                    {publishMutation.isPending ? 'Publishing…' : today?.price ? 'Update today’s price' : 'Publish today’s price'}
                  </Button>
                </form>

                {pageError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{pageError}</AlertDescription>
                  </Alert>
                ) : null}
                {notice ? (
                  <Alert role="status">
                    <AlertDescription>{notice}</AlertDescription>
                  </Alert>
                ) : null}
              </CardContent>
            </Card>

            <aside className="grid gap-6">
              <Card>
                <CardHeader>
                  <p className="text-[10px] font-medium tracking-widest text-muted-foreground">PRICE RULE</p>
                  <CardTitle>Farmers see the per‑kg equivalent</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs/relaxed text-muted-foreground">
                    Farmer offers are entered per kg. The API compares each offer
                    against this quintal price converted to kg. A price increase
                    flags affected pending offers for revision.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <p className="text-[10px] font-medium tracking-widest text-muted-foreground">SIGNED IN AS ADMIN</p>
                  <CardTitle className="tabular-nums">{session.user.phoneNumber ?? '—'}</CardTitle>
                  <CardDescription>Phone verified</CardDescription>
                </CardHeader>
              </Card>
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
                <CaretDownIcon className="size-4 transition-transform in-data-[panel-open]:rotate-180" aria-hidden />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <form className="grid gap-4 border-t p-3" onSubmit={applyOfferFilters}>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {offerFilterFields.map((field) => (
                      <div key={field.key} className="grid gap-1.5">
                        <Label htmlFor={`filter-${field.key}`} className="text-muted-foreground">
                          {field.label}
                        </Label>
                        {field.date ? (
                          <DatePicker
                            id={`filter-${field.key}`}
                            placeholder="Any date"
                            value={offerFilters[field.key]}
                            onChange={(value) => setOfferFilters((current) => ({ ...current, [field.key]: value }))}
                          />
                        ) : (
                          <Input
                            id={`filter-${field.key}`}
                            inputMode="decimal"
                            value={offerFilters[field.key]}
                            onChange={(event) =>
                              setOfferFilters((current) => ({ ...current, [field.key]: event.target.value }))
                            }
                          />
                        )}
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
                {offerFilterError ? null : (
                  <Button size="xs" variant="outline" onClick={() => void offersQuery.refetch()}>
                    Retry
                  </Button>
                )}
              </div>
            ) : offers.length === 0 ? (
              <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
                No quotes in this view yet.
              </div>
            ) : (
              <Table
                aria-busy={offersQuery.isPlaceholderData}
                className={offersQuery.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}
              >
                <TableHeader>
                  <TableRow>
                    <TableHead>Farmer</TableHead>
                    <TableHead className="text-right">Offer / kg</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Moisture</TableHead>
                    <TableHead className="text-right">Beans / 100 g</TableHead>
                    <TableHead>Ready date</TableHead>
                    <TableHead>Pickup</TableHead>
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
                        <FarmerCell farmer={offer} />
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
                      <TableCell className="max-w-64 min-w-44 whitespace-normal">
                        {offer.pickupLocation ?? <span className="text-muted-foreground">Not provided</span>}
                      </TableCell>
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
                            disabled={deciding || offer.status !== 'pending'}
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
                            disabled={deciding}
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
            open={confirmingPrice !== null}
            onOpenChange={(open) => {
              if (!open && !publishMutation.isPending) setConfirmingPrice(null)
            }}
          >
            <AlertDialogContent>
              {confirmingPrice ? (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {today?.price ? 'Update today’s Cocoa price?' : 'Publish today’s Cocoa price?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Check the base price before publishing. Farmers see it straight away
                      {today ? ` for ${formatDateForIndia(today.businessDate)}` : ''}, and pending quotes
                      may be flagged for the farmer to revise.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <p className="flex items-baseline justify-center gap-1 font-heading tabular-nums">
                    <span className="text-xl text-muted-foreground">₹</span>
                    <span className="text-4xl">
                      {confirmingPrice.priceUnit === 'kg' ? confirmingPrice.perKg : confirmingPrice.perQuintal}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      / {confirmingPrice.priceUnit === 'kg' ? 'kg' : 'quintal'}
                    </span>
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 bg-muted px-3 py-2 text-xs">
                    <dt className="text-muted-foreground">Per quintal</dt>
                    <dd className="text-right tabular-nums">₹{confirmingPrice.perQuintal}</dd>
                    <dt className="text-muted-foreground">Per kg</dt>
                    <dd className="text-right tabular-nums">₹{confirmingPrice.perKg}</dd>
                    {today?.price && confirmingPrice.change ? (
                      <>
                        <dt className="text-muted-foreground">Current price</dt>
                        <dd className="text-right tabular-nums">
                          ₹{formatPrice(today.price.basePricePerQuintal)} / quintal
                        </dd>
                        <dt className="text-muted-foreground">Change</dt>
                        <dd className="text-right tabular-nums">
                          {confirmingPrice.change.percent === 0
                            ? 'No change'
                            : `${confirmingPrice.change.perQuintal} / quintal (${confirmingPrice.change.percent > 0 ? '+' : '−'}${Math.abs(confirmingPrice.change.percent).toFixed(1)}%)`}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {confirmingPrice.change && Math.abs(confirmingPrice.change.percent) >= LARGE_PRICE_CHANGE_PERCENT ? (
                    <Alert variant="destructive">
                      <AlertDescription>
                        This is a {Math.abs(confirmingPrice.change.percent).toFixed(1)}% change from the current
                        price. Make sure the amount and unit are right.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                  {priceConfirmError ? (
                    <p className="text-xs text-destructive" role="alert">{priceConfirmError}</p>
                  ) : null}
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={publishMutation.isPending}>Go back and edit</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={publishMutation.isPending}
                      onClick={() => void publishPrice(confirmingPrice)}
                    >
                      {publishMutation.isPending
                        ? 'Publishing…'
                        : `Publish ₹${confirmingPrice.priceUnit === 'kg' ? `${confirmingPrice.perKg} / kg` : `${confirmingPrice.perQuintal} / quintal`}`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              ) : null}
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog
            open={acceptingOffer !== null}
            onOpenChange={(open) => {
              if (!open && !deciding) setAcceptingOffer(null)
            }}
          >
            <AlertDialogContent>
              {acceptingOffer ? (
                <>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Accept quote and create deal?</AlertDialogTitle>
                    <AlertDialogDescription>
                      These terms from {farmerLabel(acceptingOffer)} will be locked into the deal,
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
                    <AlertDialogCancel disabled={deciding}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={deciding}
                      onClick={() => void acceptOffer(acceptingOffer)}
                    >
                      {acceptMutation.isPending ? 'Accepting…' : 'Accept & create deal'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </>
              ) : null}
            </AlertDialogContent>
          </AlertDialog>

          <Dialog
            open={rejectingOffer !== null}
            onOpenChange={(open) => {
              if (!open && !deciding) setRejectingOffer(null)
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
                      Quote from {farmerLabel(rejectingOffer)}: ₹{rejectingOffer.offeredPricePerKg} / kg
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
                    <DialogClose render={<Button type="button" variant="outline" disabled={deciding} />}>
                      Cancel
                    </DialogClose>
                    <Button type="submit" variant="destructive" disabled={deciding}>
                      {rejectMutation.isPending ? 'Rejecting…' : 'Reject quote'}
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
              {dealsQuery.isPending ? (
                <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
                  Loading deals…
                </div>
              ) : deals.length === 0 ? (
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
                          <TableCell>
                            <FarmerCell farmer={deal} />
                          </TableCell>
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
                      Set the date for the driver to collect cocoa from {farmerLabel(deal)}.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="bg-muted px-3 py-2 text-xs whitespace-pre-wrap">
                    <strong>Pickup location:</strong> {deal.pickupLocation}
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="pickup-scheduled-on">Pickup date</Label>
                    <DatePicker
                      id="pickup-scheduled-on"
                      placeholder="Pick the pickup date"
                      value={pickupInputs[deal.id] ?? (deal.pickupScheduledOn ? formatDateForIndia(deal.pickupScheduledOn) : '')}
                      onChange={(value) => setPickupInputs((current) => ({ ...current, [deal.id]: value }))}
                    />
                  </div>
                  {dealError ? <p className="text-xs text-destructive" role="alert">{dealError}</p> : null}
                  <DialogFooter>
                    <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
                    <Button type="submit" disabled={pickupMutation.isPending}>
                      {pickupMutation.isPending ? 'Saving…' : deal.pickupScheduledOn ? 'Save new pickup date' : 'Save pickup date'}
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
                      Record the date the driver collected cocoa from {farmerLabel(deal)} and the weight on the scale.
                    </DialogDescription>
                  </DialogHeader>
                  <p className="bg-muted px-3 py-2 text-xs">
                    <strong>Accepted quote quantity:</strong> {deal.quantityQuintals} quintals
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="collected-on">Collection date</Label>
                    <DatePicker
                      id="collected-on"
                      placeholder="Pick the collection date"
                      disableFuture
                      value={collectionForm.collectedOn}
                      onChange={(collectedOn) => setCollectionForm((current) => ({ ...current, collectedOn }))}
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
                    <Button type="submit" disabled={collectionMutation.isPending}>
                      {collectionMutation.isPending ? 'Saving…' : deal.collectedOn ? 'Save changes' : 'Save collection'}
                    </Button>
                  </DialogFooter>
                </form>
              )
            })()}
          </DialogContent>
        </Dialog>
    </>
  )
}
