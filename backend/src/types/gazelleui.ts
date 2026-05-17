/**
 * GazelleUI API Types
 *
 * Types for the GazelleUI private tracker download server API.
 * GazelleUI provides search and download for Gazelle-based music trackers.
 */

/** Release type IDs used by Gazelle-based trackers */
export const RELEASE_TYPE_MAP: Record<number, string> = {
    1: "Album",
    3: "Soundtrack",
    5: "EP",
    6: "Anthology",
    7: "Compilation",
    9: "Single",
    11: "Live album",
    13: "Remix",
    14: "Bootleg",
    15: "Interview",
    16: "Mixtape",
    17: "Demo",
    18: "Concert Recording",
    19: "DJ Mix",
    21: "Unknown",
};

/**
 * A flattened torrent result from a GazelleUI artist search.
 * The API returns nested torrentgroup[] -> torrent[], this is the
 * flattened per-torrent view used for scoring and matching.
 */
export interface GazelleUIArtistSearchResult {
    torrentId: number;
    artistName: string;
    albumTitle: string;
    year?: number;
    format?: string;
    encoding?: string;
    media?: string;
    size?: string;
    seeders?: number;
    leechers?: number;
    snatches?: number;
    /** Release type (e.g. "Album", "EP", "Single") */
    releaseType?: string;
    /** Numeric release type from the tracker */
    releaseTypeId?: number;
    groupId?: number;
}

export interface GazelleUIDownloadRequest {
    torrent_id: number;
}

export interface GazelleUIDownloadResponse {
    status: 'queued' | 'downloading' | 'downloaded' | 'failed';
    torrent_id: string;
}

export interface GazelleUIDownload {
    status: 'queued' | 'downloading' | 'downloaded' | 'failed';
    torrent_id: string;
}

export interface GazelleUIDownloadListResponse {
    downloads: GazelleUIDownload[];
    total: number;
}
