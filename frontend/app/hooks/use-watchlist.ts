import * as React from "react"
import { toast } from "sonner"
import { apiGet, apiPut, apiDelete, apiPost, type AssetResponse, type WatchlistEntryResponse, type WatchlistListResponse, type PaginatedResponse } from "~/lib/api-client"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const isUuid = (value: string) => UUID_REGEX.test(value)

export function useWatchlist(assets: AssetResponse[] = []) {
  const [watchlist, setWatchlist] = React.useState<WatchlistEntryResponse[]>([])
  const [watchlistLists, setWatchlistLists] = React.useState<WatchlistListResponse[]>([])
  const [watchlistAssetsByListId, setWatchlistAssetsByListId] = React.useState<Record<string, AssetResponse[]>>({})
  const [addingId, setAddingId] = React.useState<string | null>(null)
  const [creatingWatchlist, setCreatingWatchlist] = React.useState(false)

  const fetchWatchlist = React.useCallback(async () => {
    try {
      const data = await apiGet<WatchlistEntryResponse[]>("/users/me/watchlist")
      setWatchlist(data)
    } catch (err) {
      console.error("Failed to fetch watchlist:", err)
    }
  }, [])

  const fetchWatchlistLists = React.useCallback(async () => {
    try {
      const data = await apiGet<WatchlistListResponse[]>("/users/me/watchlists")
      setWatchlistLists(data)
      const assetResults = await Promise.allSettled(
        data.map(async (list) => {
          const entries = await apiGet<Array<{ list_id: string; asset: AssetResponse }>>(
            `/users/me/watchlists/${list.id}/assets`,
          )
          return [list.id, entries.map((entry) => entry.asset)] as const
        }),
      )
      const nextAssetsByListId: Record<string, AssetResponse[]> = {}
      for (const result of assetResults) {
        if (result.status === "fulfilled") {
          const [listId, listAssets] = result.value
          nextAssetsByListId[listId] = listAssets
        }
      }
      setWatchlistAssetsByListId(nextAssetsByListId)
    } catch {
      setWatchlistLists([])
      setWatchlistAssetsByListId({})
    }
  }, [])

  const resolveBackendAssetId = React.useCallback(async (asset: AssetResponse): Promise<string> => {
    if (isUuid(asset.id)) return asset.id
    const symbol = asset.symbol.toUpperCase()
    const existing = assets.find(a => a.symbol.toUpperCase() === symbol && isUuid(a.id))?.id
    if (existing) return existing

    try {
      const created = await apiPost<AssetResponse>("/assets/ensure", {
        symbol: asset.symbol,
        name: asset.name,
        category: asset.category || "General",
        coingecko_id: asset.coingecko_id || null,
        is_active: true,
      })
      if (created?.id) return created.id
      throw new Error(`Ensure endpoint returned no id for ${asset.symbol}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to ensure ${asset.symbol}`
      throw new Error(message)
    }
  }, [assets])

  const handleAdd = React.useCallback(async (asset: AssetResponse) => {
    setAddingId(asset.id)
    try {
      await apiPut("/users/me/watchlist/" + asset.id)
      await fetchWatchlist()
      toast.success(`Added ${asset.symbol}`)
    } catch (err) {
      toast.error(`Failed to add ${asset.symbol}`)
    } finally {
      setAddingId(null)
    }
  }, [fetchWatchlist])

  const handleRemove = React.useCallback(async (assetId: string, symbol: string) => {
    try {
      await apiDelete("/users/me/watchlist/" + assetId)
      await fetchWatchlist()
      toast.success(`Removed ${symbol}`)
    } catch (err) {
      toast.error(`Failed to remove ${symbol}`)
    }
  }, [fetchWatchlist])

  const toggleWatchlist = React.useCallback(async (asset: AssetResponse) => {
    try {
      const backendId = await resolveBackendAssetId(asset)
      const isWatched = watchlist.some(w => w.asset.id === backendId || w.asset.symbol.toUpperCase() === asset.symbol.toUpperCase())
      if (isWatched) {
        await handleRemove(backendId, asset.symbol)
      } else {
        await handleAdd({ ...asset, id: backendId })
      }
    } catch (err) {
      toast.error(`Watchlist sync failed`)
    }
  }, [watchlist, resolveBackendAssetId, handleRemove, handleAdd])

  const addAssetToNamedWatchlist = React.useCallback(async (asset: AssetResponse, listId: string) => {
    try {
      const backendId = await resolveBackendAssetId(asset)
      await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
      await apiPut(`/users/me/watchlist/${backendId}`)
      await fetchWatchlist()
      await fetchWatchlistLists()
      toast.success(`Added ${asset.symbol} to watchlist`)
    } catch (err) {
      toast.error(`Failed to add ${asset.symbol}`)
    }
  }, [resolveBackendAssetId, fetchWatchlist, fetchWatchlistLists])

  const toggleAssetInNamedWatchlist = React.useCallback(async (asset: AssetResponse, listId: string, currentlyInList: boolean) => {
    try {
      const backendId = await resolveBackendAssetId(asset)
      if (currentlyInList) {
        await apiDelete(`/users/me/watchlists/${listId}/assets/${backendId}`)
        await apiDelete(`/users/me/watchlist/${backendId}`)
        toast.success(`Removed ${asset.symbol}`)
      } else {
        await apiPut(`/users/me/watchlists/${listId}/assets/${backendId}`)
        await apiPut(`/users/me/watchlist/${backendId}`)
        toast.success(`Added ${asset.symbol}`)
      }
      await fetchWatchlist()
      await fetchWatchlistLists()
    } catch (err) {
      toast.error(`Update failed`)
    }
  }, [resolveBackendAssetId, fetchWatchlist, fetchWatchlistLists])

  const createWatchlistList = React.useCallback(async (name: string, selectedAsset?: AssetResponse | null) => {
    setCreatingWatchlist(true)
    try {
      const newList = await apiPost<WatchlistListResponse>("/users/me/watchlists", { name })
      await fetchWatchlistLists()
      if (selectedAsset && newList?.id) {
        await addAssetToNamedWatchlist(selectedAsset, newList.id)
      }
      toast.success(`Watchlist "${name}" created`)
      return true
    } catch {
      toast.error("Failed to create watchlist")
      return false
    } finally {
      setCreatingWatchlist(false)
    }
  }, [fetchWatchlistLists, addAssetToNamedWatchlist])

  const watchedIds = React.useMemo(() => {
    const ids = new Set<string>()
    watchlist.forEach((w) => {
      if (w.asset.id) ids.add(w.asset.id)
      if (w.asset.symbol) ids.add(w.asset.symbol.toUpperCase())
    })
    return ids
  }, [watchlist])

  React.useEffect(() => {
    void fetchWatchlist()
    void fetchWatchlistLists()
  }, [fetchWatchlist, fetchWatchlistLists])

  return {
    watchlist,
    watchlistLists,
    watchlistAssetsByListId,
    watchedIds,
    addingId,
    creatingWatchlist,
    toggleWatchlist,
    addAssetToNamedWatchlist,
    toggleAssetInNamedWatchlist,
    createWatchlistList,
    refresh: () => {
      void fetchWatchlist()
      void fetchWatchlistLists()
    }
  }
}
