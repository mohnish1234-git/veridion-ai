import api from "./api";

export interface AssetSearchResult {
  ticker: string;
  name: string;
  assetType?: string;
  exchange?: string;
  sector?: string;
  region?: string;
}

export interface AssetMetadata {
  id?: number;
  ticker: string;
  name: string;
  assetType?: string;
  sector?: string;
  country?: string;
}

export async function searchAssets(query: string): Promise<AssetSearchResult[]> {
  if (!query || query.length < 2) return [];

  const { data } = await api.get<AssetSearchResult[]>("/market/assets/search", {
    params: { q: query }
  });

  return data;
}

export async function getAssetMetadata(ticker: string): Promise<AssetMetadata> {

  const { data } = await api.get<AssetMetadata>(`/market/assets/${ticker}`);

  return data;

}