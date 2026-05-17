import { gazelleUIService } from "../gazelleui";
import type { GazelleUIArtistSearchResult } from "../../types/gazelleui";

// Mock searchArtists so we control the results without hitting HTTP
jest.spyOn(gazelleUIService as any, "ensureInitialized").mockResolvedValue(undefined);

function mockSearch(results: GazelleUIArtistSearchResult[]) {
    return jest.spyOn(gazelleUIService as any, "searchArtists").mockResolvedValue(results);
}

describe("findAlbumTorrent scoring", () => {
    afterEach(() => jest.restoreAllMocks());

    it("prefers exact artist + album match over partial matches", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Radiohead", albumTitle: "OK Computer" },
            { torrentId: 2, artistName: "Radiohead Cover Band", albumTitle: "OK Computer Tribute" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Radiohead", "OK Computer");
        expect(result?.torrentId).toBe(1);
    });

    it("prefers albums over EPs over singles", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "Single" },
            { torrentId: 2, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "EP" },
            { torrentId: 3, artistName: "Boards of Canada", albumTitle: "Geogaddi", releaseType: "Album" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Boards of Canada", "Geogaddi");
        expect(result?.torrentId).toBe(3);
    });

    it("prefers FLAC over other formats with equal match", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Aphex Twin", albumTitle: "Selected Ambient Works 85-92", format: "MP3" },
            { torrentId: 2, artistName: "Aphex Twin", albumTitle: "Selected Ambient Works 85-92", format: "FLAC" },
        ]);

        const result = await gazelleUIService.findAlbumTorrent("Aphex Twin", "Selected Ambient Works 85-92");
        expect(result?.torrentId).toBe(2);
    });

    it("prefers more seeders as tiebreaker", async () => {
        mockSearch([
            { torrentId: 1, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", seeders: 5 },
            { torrentId: 2, artistName: "Burial", albumTitle: "Untrue", format: "FLAC", seeders: 50 },
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
});
