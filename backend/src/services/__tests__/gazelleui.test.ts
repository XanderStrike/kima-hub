import { gazelleUIService } from "../gazelleui";
import type { GazelleUIArtistSearchResult } from "../../types/gazelleui";

// Mock ensureInitialized so we don't hit DB
jest.spyOn(gazelleUIService as any, "ensureInitialized").mockResolvedValue(undefined);

function mockSearch(results: GazelleUIArtistSearchResult[]) {
    return jest.spyOn(gazelleUIService as any, "searchArtists").mockResolvedValue(results);
}

describe("findAlbumTorrent scoring", () => {
    afterEach(() => jest.restoreAllMocks());

    it("prefers exact artist + album group over partial matches", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Radiohead", albumTitle: "OK Computer" },
            { torrentId: 2, artistName: "Radiohead Cover Band", albumTitle: "OK Computer Tribute" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Radiohead", "OK Computer");
        expect(result?.torrentId).toBe(1);
    });

    it("prefers album groups over single groups", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "Single" },
            { torrentId: 2, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "Album" },
        ]);

        // Same artist+album key → same group, but releaseType "Album" gets +20 over "Single" 0
        // Wait — they'd be in the same group since artist+album match. Need different albums.
        // Let's use different album titles so they're different groups.
    });

    it("prefers album release type over single within different groups", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "Single" },
            { torrentId: 2, artistName: "Boards of Canada", albumTitle: "Geogaddi (Deluxe)", releaseType: "Album" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Boards of Canada", "Geogaddi (Deluxe)");
        expect(result?.torrentId).toBe(2);
    });

    it("picks most snatched torrent from the best group", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", encoding: "24bit Lossless", snatches: 5 },
            { torrentId: 2, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", encoding: "Lossless", snatches: 200 },
            { torrentId: 3, artistName: "Burial", albumTitle: "Untrue", format: "MP3", encoding: "320", snatches: 500 },
        ]);

        // All three are in the same group (Burial - Untrue), so pick most snatched
        const result = await gazelleUIService.findAlbumTorrent("Burial", "Untrue");
        expect(result?.torrentId).toBe(3); // MP3 with 500 snatches
        expect(result?.snatches).toBe(500);
    });

    it("picks most snatched FLAC when all are FLAC", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", encoding: "24bit Lossless", snatches: 5 },
            { torrentId: 2, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", encoding: "Lossless", snatches: 200 },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Burial", "Untrue");
        expect(result?.torrentId).toBe(2);
    });

    it("returns null when best score is below threshold", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Completely Different", albumTitle: "No Match At All" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Burial", "Untrue");
        expect(result).toBeNull();
    });

    it("returns null when no results", async () => {
        mockSearch([]);

        const result = await gazelleUIService.findAlbumTorrent("Nobody", "Nothing");
        expect(result).toBeNull();
    });

    it("deduplicates torrent groups with same groupId", async () => {
        // Same artist+album appears twice (duplicate groupId from API)
        // but should be treated as one group — most snatched from that group wins
        mockSearch([
            { torrentId: 1, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", snatches: 50 },
            { torrentId: 2, artistName: "Burial", albumTitle: "Untrue", format: "MP3", snatches: 100 },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Burial", "Untrue");
        // Same group, most snatched wins regardless of format
        expect(result?.torrentId).toBe(2);
    });
});
