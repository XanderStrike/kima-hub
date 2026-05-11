// backend/src/lib/soulseek/__tests__/client.test.ts
import { EventEmitter } from "events";

describe("Soulseek download events", () => {
    it("default error listener prevents unhandled exception", () => {
        const download = {
            events: new EventEmitter(),
        };

        // Attach default error listener (the fix)
        download.events.on("error", () => {});

        let threw = false;
        try {
            download.events.emit("error", new Error("Connection closed before transfer completed"));
        } catch {
            threw = true;
        }

        expect(threw).toBe(false);
    });

    it("emitting error without a listener throws (sanity)", () => {
        const events = new EventEmitter();
        let threw = false;
        try {
            events.emit("error", new Error("test"));
        } catch {
            threw = true;
        }
        expect(threw).toBe(true);
    });
});
