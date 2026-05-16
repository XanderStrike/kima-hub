"use client";

import { SettingsSection, SettingsRow, SettingsSelect } from "../ui";
import { SystemSettings } from "../../types";

interface DownloadPreferencesSectionProps {
    settings: SystemSettings;
    onUpdate: (updates: Partial<SystemSettings>) => void;
}

export function DownloadPreferencesSection({
    settings,
    onUpdate,
}: DownloadPreferencesSectionProps) {
    // Service configuration detection
    const isLidarrConfigured =
        settings.lidarrEnabled === true &&
        settings.lidarrUrl.trim() !== "" &&
        settings.lidarrApiKey.trim() !== "";

    const isSoulseekConfigured =
        settings.soulseekUsername.trim() !== "" &&
        settings.soulseekPassword.trim() !== "";

    const isGazelleuiConfigured =
        settings.gazelleUiEnabled === true &&
        settings.gazelleUiUrl.trim() !== "" &&
        settings.gazelleUiApiKey.trim() !== "";

    const areAnyTwoServicesConfigured =
        (isLidarrConfigured ? 1 : 0) +
        (isSoulseekConfigured ? 1 : 0) +
        (isGazelleuiConfigured ? 1 : 0) >= 2;
    const isDisabled = !areAnyTwoServicesConfigured;

    // Dynamic fallback options based on primary source
    const getFallbackOptions = () => {
        const options = [{ value: "none", label: "Skip" }];
        if (settings.downloadSource !== "lidarr" && isLidarrConfigured) {
            options.push({ value: "lidarr", label: "Download full album via Lidarr" });
        }
        if (settings.downloadSource !== "soulseek" && isSoulseekConfigured) {
            options.push({ value: "soulseek", label: "Try Soulseek for individual tracks" });
        }
        if (settings.downloadSource !== "gazelleui" && isGazelleuiConfigured) {
            options.push({ value: "gazelleui", label: "Download via GazelleUI" });
        }
        return options;
    };

    return (
        <SettingsSection
            id="download-preferences"
            title="Download Preferences"
            description="Configure how music is downloaded for playlists and discovery"
        >
            <SettingsRow
                label="Primary Download Source"
                description={
                    isDisabled
                        ? "Requires at least two download sources to be configured"
                        : "Choose how to download music for imported playlists"
                }
            >
                <SettingsSelect
                    value={settings.downloadSource || "soulseek"}
                    onChange={(v) =>
                        onUpdate({
                            downloadSource: v as "soulseek" | "lidarr" | "gazelleui",
                            primaryFailureFallback: "none"
                        })
                    }
                    options={[
                        { value: "soulseek", label: "Soulseek (Per-track)" },
                        { value: "lidarr", label: "Lidarr (Full albums)" },
                        ...(isGazelleuiConfigured ? [{ value: "gazelleui", label: "GazelleUI (Tracker)" }] : []),
                    ]}
                    disabled={isDisabled}
                />
            </SettingsRow>

            <SettingsRow
                label={
                    settings.downloadSource === "soulseek"
                        ? "When Soulseek Fails"
                        : "When Lidarr Fails"
                }
                description={
                    isDisabled
                        ? "Requires at least two download sources to be configured"
                        : settings.downloadSource === "soulseek"
                        ? "What to do if a track can't be found on Soulseek"
                        : settings.downloadSource === "gazelleui"
                        ? "What to do if an album can't be found on GazelleUI"
                        : "What to do if an album can't be found on Lidarr"
                }
            >
                <SettingsSelect
                    value={settings.primaryFailureFallback || "none"}
                    onChange={(v) =>
                        onUpdate({
                            primaryFailureFallback: v as "none" | "lidarr" | "soulseek" | "gazelleui",
                        })
                    }
                    options={getFallbackOptions()}
                    disabled={isDisabled}
                />
            </SettingsRow>

            <SettingsRow
                label="Soulseek Concurrent Downloads"
                description="Number of simultaneous downloads when using Soulseek (1-10)"
            >
                <SettingsSelect
                    value={settings.soulseekConcurrentDownloads?.toString() || "4"}
                    onChange={(v) =>
                        onUpdate({
                            soulseekConcurrentDownloads: parseInt(v),
                        })
                    }
                    options={[
                        { value: "1", label: "1" },
                        { value: "2", label: "2" },
                        { value: "3", label: "3" },
                        { value: "4", label: "4 (Default)" },
                        { value: "5", label: "5" },
                        { value: "6", label: "6" },
                        { value: "7", label: "7" },
                        { value: "8", label: "8" },
                        { value: "9", label: "9" },
                        { value: "10", label: "10" },
                    ]}
                    disabled={!isSoulseekConfigured}
                />
            </SettingsRow>
        </SettingsSection>
    );
}
