"use client";

import { useState } from "react";
import { SettingsSection, SettingsRow, SettingsInput, SettingsToggle } from "../ui";
import { SystemSettings } from "../../types";
import { InlineStatus, StatusType } from "@/components/ui/InlineStatus";

interface GazelleUISectionProps {
    settings: SystemSettings;
    onUpdate: (updates: Partial<SystemSettings>) => void;
    onTest: (service: string) => Promise<{ success: boolean; version?: string; error?: string }>;
    isTesting: boolean;
}

export function GazelleUISection({ settings, onUpdate, onTest, isTesting }: GazelleUISectionProps) {
    const [testStatus, setTestStatus] = useState<StatusType>("idle");
    const [testMessage, setTestMessage] = useState("");

    const handleTest = async () => {
        setTestStatus("loading");
        setTestMessage("Testing...");
        const result = await onTest("gazelleui");
        if (result.success) {
            setTestStatus("success");
            setTestMessage(result.version ? `v${result.version}` : "Connected");
        } else {
            setTestStatus("error");
            setTestMessage(result.error || "Failed");
        }
    };

    return (
        <SettingsSection
            id="gazelleui"
            title="GazelleUI"
            description="Private tracker download server for Gazelle-based music sites"
        >
            <SettingsRow
                label="Enable GazelleUI"
                description="Connect to GazelleUI for tracker-based album downloads"
                htmlFor="gazelleui-enabled"
            >
                <SettingsToggle
                    id="gazelleui-enabled"
                    checked={settings.gazelleUiEnabled}
                    onChange={(checked) => onUpdate({ gazelleUiEnabled: checked })}
                />
            </SettingsRow>

            {settings.gazelleUiEnabled && (
                <>
                    <SettingsRow label="Server URL">
                        <SettingsInput
                            value={settings.gazelleUiUrl}
                            onChange={(v) => onUpdate({ gazelleUiUrl: v })}
                            placeholder="http://localhost:2020"
                            className="w-64"
                        />
                    </SettingsRow>

                    <SettingsRow label="API Key">
                        <SettingsInput
                            type="password"
                            value={settings.gazelleUiApiKey}
                            onChange={(v) => onUpdate({ gazelleUiApiKey: v })}
                            placeholder="Enter API key"
                            className="w-64"
                        />
                    </SettingsRow>

                    <div className="pt-2">
                        <div className="inline-flex items-center gap-3">
                            <button
                                onClick={handleTest}
                                disabled={isTesting || !settings.gazelleUiUrl || !settings.gazelleUiApiKey}
                                className="px-4 py-1.5 text-xs font-mono bg-white/5 border border-white/10 text-white/70 rounded-lg uppercase tracking-wider
                                    hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {testStatus === "loading" ? "Testing..." : "Test Connection"}
                            </button>
                            <InlineStatus
                                status={testStatus}
                                message={testMessage}
                                onClear={() => setTestStatus("idle")}
                            />
                        </div>
                    </div>
                </>
            )}
        </SettingsSection>
    );
}
