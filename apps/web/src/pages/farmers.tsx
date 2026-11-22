import { MagnifyingGlassIcon } from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { queryOptions, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
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
import { apiRequest, getErrorMessage } from '@/lib/api'
import { formatPrice, formatSubmittedAt } from '@/lib/format'
import { queryKeys } from '@/lib/queries'

type AdminFarmer = {
  userId: string
  phoneNumber: string | null
  signedUpAt: string
  aadhaarName: string | null
  village: string | null
  mandal: string | null
  farmSizeAcres: string | null
  cocoaTreeCount: number | null
  onboardedAt: string | null
  defaultAddressLabel: string | null
  defaultAddress: string | null
  addressCount: number
  quoteCount: number
  dealCount: number
  lastQuoteAt: string | null
}

type OnboardingFilter = 'all' | 'onboarded' | 'pending'

const onboardingFilterOptions: Record<OnboardingFilter, string> = {
  all: 'All farmers',
  onboarded: 'Onboarded',
  pending: 'Details missing',
}

function matchesSearch(farmer: AdminFarmer, query: string) {
  if (!query) return true
  const haystack = [
    farmer.aadhaarName,
    farmer.phoneNumber,
    farmer.village,
    farmer.mandal,
    farmer.defaultAddress,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

/** Shared by the page and the route loader, so a preload fills the same cache entry. */
export const farmersQueryOptions = queryOptions({
  queryKey: queryKeys.farmers,
  queryFn: () => apiRequest<{ farmers: AdminFarmer[] }>('/api/admin/farmers'),
})

export function FarmersPage() {
  const [search, setSearch] = useState('')
  const [onboardingFilter, setOnboardingFilter] = useState<OnboardingFilter>('all')

  const farmersQuery = useQuery(farmersQueryOptions)
  const farmers = useMemo(() => farmersQuery.data?.farmers ?? [], [farmersQuery.data])
  // Show the spinner again while "Try again" refetches after an error.
  const loading = farmersQuery.isPending || (farmersQuery.isError && farmersQuery.isFetching)
  const error = farmersQuery.isError ? getErrorMessage(farmersQuery.error) : null

  function loadFarmers() {
    void farmersQuery.refetch()
  }

  const onboardedCount = farmers.filter((farmer) => farmer.onboardedAt).length

  const visibleFarmers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return farmers.filter((farmer) => {
      if (onboardingFilter === 'onboarded' && !farmer.onboardedAt) return false
      if (onboardingFilter === 'pending' && farmer.onboardedAt) return false
      return matchesSearch(farmer, query)
    })
  }, [farmers, search, onboardingFilter])

  return (
    <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-1">
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground">PROCUREMENT · COCOA</p>
          <h1 className="font-heading text-2xl">Farmers</h1>
          <p className="text-xs text-muted-foreground">
            Everyone who has signed up in the farmer app, with their farm and pickup details.
          </p>
        </div>
        {!loading && !error ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="tabular-nums">{farmers.length} signed up</Badge>
            <Badge variant="outline" className="tabular-nums">{onboardedCount} onboarded</Badge>
            {farmers.length - onboardedCount > 0 ? (
              <Badge variant="secondary" className="tabular-nums">
                {farmers.length - onboardedCount} missing details
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <p className="text-[10px] font-medium tracking-widest text-muted-foreground">FARMER DIRECTORY</p>
          <CardTitle className="text-lg">All farmers</CardTitle>
          <CardDescription>
            Search by name, phone, village, mandal or address. The newest 500 sign-ups are shown.
          </CardDescription>
          <CardAction>
            <Select
              items={onboardingFilterOptions}
              value={onboardingFilter}
              onValueChange={(value) => {
                if (value) setOnboardingFilter(value)
              }}
            >
              <SelectTrigger aria-label="Filter farmers" className="min-w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(onboardingFilterOptions) as OnboardingFilter[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {onboardingFilterOptions[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <MagnifyingGlassIcon aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              placeholder="Search farmers"
              aria-label="Search farmers"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </InputGroup>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center text-xs text-muted-foreground">
              Loading farmers…
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                {error}
                <Button size="xs" variant="outline" onClick={loadFarmers}>
                  Try again
                </Button>
              </AlertDescription>
            </Alert>
          ) : visibleFarmers.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center border border-dashed text-xs text-muted-foreground">
              {farmers.length === 0 ? 'No farmers have signed up yet.' : 'No farmers match this search.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Village · Mandal</TableHead>
                  <TableHead className="text-right">Farm</TableHead>
                  <TableHead>Default pickup address</TableHead>
                  <TableHead className="text-right">Quotes · Deals</TableHead>
                  <TableHead>Signed up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleFarmers.map((farmer) => (
                  <TableRow key={farmer.userId}>
                    <TableCell>
                      <Link
                        to="/farmers/$farmerId"
                        params={{ farmerId: farmer.userId }}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {farmer.aadhaarName ?? farmer.phoneNumber ?? 'Unknown farmer'}
                      </Link>
                      {farmer.aadhaarName && farmer.phoneNumber ? (
                        <span className="block text-[10px] text-muted-foreground tabular-nums">
                          {farmer.phoneNumber}
                        </span>
                      ) : null}
                      {!farmer.onboardedAt ? (
                        <Badge variant="secondary" className="mt-1">Details missing</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {farmer.village || farmer.mandal ? (
                        <>
                          {farmer.village ?? '—'}
                          <span className="block text-[10px] text-muted-foreground">
                            {farmer.mandal ? `${farmer.mandal} mandal` : ''}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {farmer.farmSizeAcres ? (
                        <>
                          {formatPrice(farmer.farmSizeAcres)} ac
                          <span className="block text-[10px] text-muted-foreground">
                            {farmer.cocoaTreeCount?.toLocaleString('en-IN') ?? '—'} trees
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-72 min-w-52 whitespace-normal">
                      {farmer.defaultAddress ? (
                        <>
                          <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
                            {farmer.defaultAddressLabel?.toUpperCase()}
                          </span>
                          <span className="block">{farmer.defaultAddress}</span>
                          {farmer.addressCount > 1 ? (
                            <span className="block text-[10px] text-muted-foreground">
                              +{farmer.addressCount - 1} more saved
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">No saved address</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {farmer.quoteCount} · {farmer.dealCount}
                      <span className="block text-[10px] text-muted-foreground">
                        {farmer.lastQuoteAt ? `Last ${formatSubmittedAt(farmer.lastQuoteAt)}` : 'No quotes yet'}
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{formatSubmittedAt(farmer.signedUpAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
