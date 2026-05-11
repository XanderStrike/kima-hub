import { audiobookshelfService } from "../audiobookshelf";

describe("audiobookshelf streamAudiobook track resolution", () => {
    const unsortedAudiobook = {
        id: "test-abid",
        media: {
            tracks: [
                { index: 2, startOffset: 1200, duration: 1200, contentUrl: "/abs/t2" },
                { index: 3, startOffset: 2400, duration: 1200, contentUrl: "/abs/t3" },
                { index: 1, startOffset: 0, duration: 1200, contentUrl: "/abs/t1" },
            ],
        },
    };

    beforeEach(() => {
        jest.spyOn(audiobookshelfService as any, "ensureInitialized").mockResolvedValue(undefined);
        jest.spyOn(audiobookshelfService as any, "getAudiobook").mockResolvedValue(unsortedAudiobook);
        (audiobookshelfService as any).client = {
            get: jest.fn().mockResolvedValue({
                data: "stream-data",
                headers: {},
                status: 200,
            }),
        };
    });

    afterEach(() => jest.restoreAllMocks());

    it("resolves trackIndex=1 to the track with index 1, not array position 1", async () => {
        await audiobookshelfService.streamAudiobook("test-abid", undefined, 1);
        const client = (audiobookshelfService as any).client;
        expect(client.get).toHaveBeenCalledWith("/abs/t1", expect.any(Object));
    });

    it("resolves trackIndex=3 to the track with index 3", async () => {
        await audiobookshelfService.streamAudiobook("test-abid", undefined, 3);
        const client = (audiobookshelfService as any).client;
        expect(client.get).toHaveBeenCalledWith("/abs/t3", expect.any(Object));
    });

    it("falls back to track index 1 (first by startOffset) when trackIndex is unknown", async () => {
        await audiobookshelfService.streamAudiobook("test-abid", undefined, 99);
        const client = (audiobookshelfService as any).client;
        expect(client.get).toHaveBeenCalledWith("/abs/t1", expect.any(Object));
    });
});
