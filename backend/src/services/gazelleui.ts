/**
 * GazelleUI Service
 *
 * Client for the GazelleUI private tracker download server.
 * Provides artist search, torrent download queuing, and download status tracking.
 */

import axios, { AxiosInstance } from "axios";
import { logger } from "../utils/logger";
import { getSystemSettings } from "../utils/systemSettings";
import type {
    GazelleUIArtistSearchResult,
    GazelleUIDownload,
} from "../types/gazelleui";

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
     * Search for artists/albums on the tracker via GazelleUI
     *
     * @param query - Search query (artist name, album title, etc.)
     * @returns Array of matching torrent results
     */
    async searchArtists(query: string): Promise<GazelleUIArtistSearchResult[]> {
        await this.ensureInitialized();
        if (!this.client) {
            throw new Error("GazelleUI not configured");
        }

        try {
            const response = await this.client.get("/artists/search", {
                params: { q: query },
            });

            // Handle both array and object responses
            const data = response.data;
            if (Array.isArray(data)) {
                return data;
            }
            if (data?.results && Array.isArray(data.results)) {
                return data.results;
            }
            if (data?.data && Array.isArray(data.data)) {
                return data.data;
            }

            logger.warn("[GazelleUI] Unexpected search response format:", typeof data);
            return [];
        } catch (error: any) {
            logger.error(`[GazelleUI] Artist search failed for "${query}":`, error.message);
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
            // Handle various response shapes
            if (Array.isArray(data)) return data;
            if (data?.downloads && Array.isArray(data.downloads)) return data.downloads;
            if (data?.data && Array.isArray(data.data)) return data.data;

            return [];
        } catch (error: any) {
            logger.error("[GazelleUI] Failed to list downloads:", error.message);
            throw error;
        }
    }

    /**
     * Search for an album and return the best matching torrent
     *
     * @param artistName - Artist name to search for
     * @param albumTitle - Album title to match
     * @returns Best matching torrent result, or null
     */
    async findAlbumTorrent(
        artistName: string,
        albumTitle: string
    ): Promise<GazelleUIArtistSearchResult | null> {
        const query = `${artistName} ${albumTitle}`;
        const results = await this.searchArtists(query);

        if (results.length === 0) {
            logger.debug(`[GazelleUI] No results for "${query}"`);
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
                if (r.releaseType?.toLowerCase() === "album") score += 20;
                else if (r.releaseType?.toLowerCase() === "ep") score += 10;

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
