/**
 * GazelleUI API Types
 *
 * Types for the GazelleUI private tracker download server API.
 * GazelleUI provides search and download for Gazelle-based music trackers.
 */

export interface GazelleUIArtistSearchResult {
    torrentId: number;
    artistName: string;
    albumTitle: string;
    year?: number;
    format?: string;
    encoding?: string;
    size?: number;
    seeders?: number;
    leechers?: number;
    snatches?: number;
    /** Release type (e.g. "Album", "EP", "Single") */
    releaseType?: string;
}

export interface GazelleUIArtistSearchResponse {
    results: GazelleUIArtistSearchResult[];
}

export interface GazelleUIDownloadRequest {
    torrent_id: number;
}

export interface GazelleUIDownloadResponse {
    id: number;
    torrent_id: number;
    status: 'queued' | 'downloading' | 'downloaded' | 'failed';
    artist?: string;
    album?: string;
    created_at?: string;
}

export interface GazelleUIDownload {
    id: number;
    torrent_id: number;
    status: 'queued' | 'downloading' | 'downloaded' | 'failed';
    artist?: string;
    album?: string;
    created_at?: string;
    completed_at?: string;
    file_path?: string;
}

export interface GazelleUIDownloadListResponse {
    downloads: GazelleUIDownload[];
    total: number;
}
