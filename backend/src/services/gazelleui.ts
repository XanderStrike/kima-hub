/**
 * GazelleUI Service
 *
 * Client for the GazelleUI private tracker download server.
 * Provides artist search, torrent download queuing, and download status tracking.
 *
 * The GazelleUI API searches by artist name and returns nested
 * torrentgroup[] -> torrent[] structures. This service flattens them
 * into individual torrent results for scoring and matching.
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger";
import { getSystemSettings } from "../utils/systemSettings";
import type {
    GazelleUIArtistSearchResult,
    GazelleUIDownload,
} from "../types/gazelleui";
import { RELEASE_TYPE_MAP } from "../types/gazelleui";

/** Raw shape returned by the GazelleUI /api/v1/artists/search endpoint */
interface GazelleUIArtistResponse {
    name: string;
    torrentgroup: Array<{
        groupName: string;
        groupYear: number;
        releaseType: number;
        groupId: number;
        torrent: Array<{
            id: number;
            artist: string;
            album: string;
            format: string;
            encoding: string;
            media: string;
            seeders: number;
            leechers: number;
            snatched: number;
            size: string;
        }>;
    }>;
}

class GazelleUIService {
    private client: AxiosInstance | null = null;
    private enabled: boolean = false;
    private initialized: boolean = false;

    /**
     * Initialize or reinitialize the service from database settings
     */
    reinitialize(): void {
        this.initialized = false;
        this.client = null;
        this.enabled = false;
        logger.debug("[GazelleUI] Service reset, will reinitialize on next call");
    }

    /**
     * Lazy-initialize the HTTP client from database settings
     */
    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;

        try {
            const settings = await getSystemSettings();
            if (!settings?.gazelleUiEnabled || !settings?.gazelleUiUrl || !settings?.gazelleUiApiKey) {
                this.enabled = false;
                this.initialized = true;
                return;
            }

            const baseUrl = settings.gazelleUiUrl.replace(/\/+$/, "");
            const apiKey = settings.gazelleUiApiKey;

            this.client = axios.create({
                baseURL: `${baseUrl}/api/v1`,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                timeout: 30000,
            });

            this.enabled = true;
            this.initialized = true;
            logger.debug(`[GazelleUI] Initialized with URL: ${baseUrl}`);
        } catch (error) {
            logger.error("[GazelleUI] Failed to initialize:", error);
            this.enabled = false;
            this.initialized = true;
        }
    }

    /**
     * Check if GazelleUI is enabled and configured
     */
    async isEnabled(): Promise<boolean> {
        await this.ensureInitialized();
        return this.enabled;
    }

    /**
     * Search for an artist on the tracker via GazelleUI.
     * The API only accepts artist names — searching "artist album" will 404.
     * Returns flattened torrent results from all torrent groups.
     *
     * @param artistName - Artist name to search for (NOT artist+album)
     * @returns Array of matching torrent results
     */
    async searchArtists(artistName: string): Promise<GazelleUIArtistSearchResult[]> {
        await this.ensureInitialized();
        if (!this.client) {
            throw new Error("GazelleUI not configured");
        }

        try {
            const response = await this.client.get<GazelleUIArtistResponse>("/artists/search", {
                params: { q: artistName },
            });

            const data = response.data;
            if (!data?.torrentgroup || !Array.isArray(data.torrentgroup)) {
                logger.warn("[GazelleUI] Unexpected search response format:", typeof data);
                return [];
            }

            // Flatten torrentgroup[] -> torrent[] into individual results
            const results: GazelleUIArtistSearchResult[] = [];
            for (const group of data.torrentgroup) {
                const releaseType = RELEASE_TYPE_MAP[group.releaseType] || "Unknown";
                for (const t of group.torrent || []) {
                    results.push({
                        torrentId: t.id,
                        artistName: t.artist,
                        albumTitle: t.album,
                        year: group.groupYear,
                        format: t.format,
                        encoding: t.encoding,
                        media: t.media,
                        size: t.size,
                        seeders: t.seeders,
                        leechers: t.leechers,
                        snatches: t.snatched,
                        releaseType,
                        releaseTypeId: group.releaseType,
                        groupId: group.groupId,
                    });
                }
            }

            logger.debug(`[GazelleUI] Search for "${artistName}" returned ${results.length} torrents across ${data.torrentgroup.length} groups`);
            return results;
        } catch (error: any) {
            // 404 means artist not found on tracker — return empty instead of throwing
            if (error.response?.status === 404) {
                logger.debug(`[GazelleUI] Artist not found on tracker: "${artistName}"`);
                return [];
            }
            logger.error(`[GazelleUI] Artist search failed for "${artistName}":`, error.message);
            throw error;
        }
    }

    /**
     * Queue a torrent download via GazelleUI
     *
     * @param torrentId - The torrent ID to download
     * @returns Download response
     */
    async queueDownload(torrentId: number): Promise<GazelleUIDownload> {
        await this.ensureInitialized();
        if (!this.client) {
            throw new Error("GazelleUI not configured");
        }

        try {
            const response = await this.client.post("/downloads", {
                torrent_id: torrentId,
            });
            logger.debug(`[GazelleUI] Queued download for torrent ${torrentId}`);
            return response.data;
        } catch (error: any) {
            logger.error(`[GazelleUI] Failed to queue torrent ${torrentId}:`, error.message);
            throw error;
        }
    }

    /**
     * List downloads from GazelleUI
     *
     * @param status - Optional status filter ('queued' or 'downloaded')
     * @param limit - Max results (default 50, max 500)
     * @returns List of downloads
     */
    async listDownloads(status?: "queued" | "downloaded", limit?: number): Promise<GazelleUIDownload[]> {
        await this.ensureInitialized();
        if (!this.client) {
            throw new Error("GazelleUI not configured");
        }

        try {
            const params: Record<string, string | number> = {};
            if (status) params.status = status;
            if (limit) params.limit = limit;

            const response = await this.client.get("/downloads", { params });

            const data = response.data;
            if (Array.isArray(data)) return data;
            if (data?.items && Array.isArray(data.items)) return data.items;
            if (data?.downloads && Array.isArray(data.downloads)) return data.downloads;

            return [];
        } catch (error: any) {
            logger.error("[GazelleUI] Failed to list downloads:", error.message);
            throw error;
        }
    }

    /**
     * Search for an album and return the best matching torrent.
     * Searches by artist name, then scores results by album match.
     *
     * @param artistName - Artist name to search for
     * @param albumTitle - Album title to match within results
     * @returns Best matching torrent result, or null
     */
    async findAlbumTorrent(
        artistName: string,
        albumTitle: string
    ): Promise<GazelleUIArtistSearchResult | null> {
        // Search by artist name only — the API doesn't support artist+album queries
        const results = await this.searchArtists(artistName);

        if (results.length === 0) {
            logger.debug(`[GazelleUI] No results for artist "${artistName}"`);
            return null;
        }

        const normalizedArtist = artistName.toLowerCase().trim();
        const normalizedAlbum = albumTitle.toLowerCase().trim();

        // Score and rank results
        const scored = results
            .map((r) => {
                let score = 0;
                const rArtist = (r.artistName || "").toLowerCase().trim();
                const rAlbum = (r.albumTitle || "").toLowerCase().trim();

                // Exact artist match
                if (rArtist === normalizedArtist) score += 100;
                else if (rArtist.includes(normalizedArtist) || normalizedArtist.includes(rArtist)) score += 50;

                // Exact album match
                if (rAlbum === normalizedAlbum) score += 100;
                else if (rAlbum.includes(normalizedAlbum) || normalizedAlbum.includes(rAlbum)) score += 50;

                // Prefer albums over singles/EPs
                if (r.releaseType === "Album") score += 20;
                else if (r.releaseType === "EP") score += 10;

                // Prefer FLAC
                if (r.format?.toLowerCase() === "flac") score += 15;

                // Prefer more seeders
                if (r.seeders) score += Math.min(r.seeders, 20);

                return { result: r, score };
            })
            .sort((a, b) => b.score - a.score);

        const best = scored[0];
        if (best.score < 50) {
            logger.debug(`[GazelleUI] Best match too low (${best.score}): ${best.result.artistName} - ${best.result.albumTitle}`);
            return null;
        }

        logger.debug(
            `[GazelleUI] Best match (score ${best.score}): ${best.result.artistName} - ${best.result.albumTitle} (torrent ${best.result.torrentId})`
        );
        return best.result;
    }

    /**
     * Download an album by searching for it and queuing the best match
     *
     * @param artistName - Artist name
     * @param albumTitle - Album title
     * @returns The queued download, or null if no match found
     */
    async downloadAlbum(
        artistName: string,
        albumTitle: string
    ): Promise<{ download: GazelleUIDownload; torrentId: number } | null> {
        const torrent = await this.findAlbumTorrent(artistName, albumTitle);
        if (!torrent) {
            logger.debug(`[GazelleUI] No matching torrent found for: ${artistName} - ${albumTitle}`);
            return null;
        }

        const download = await this.queueDownload(torrent.torrentId);
        return { download, torrentId: torrent.torrentId };
    }
}

// Export singleton instance
export const gazelleUIService = new GazelleUIService();
