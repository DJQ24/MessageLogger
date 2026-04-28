/**
 * MessageLogger — Vendetta plugin
 *
 * Logs all incoming messages from whitelisted servers/users into persistent
 * plugin storage. Works passively in the background — you don't need to be
 * in the channel or even looking at Discord.
 */

import settings from "./settings.jsx";
import { FluxDispatcher } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { before as patchBefore } from "@vendetta/patcher";
import { findByStoreName } from "@vendetta/metro";

// ── Storage defaults ──────────────────────────────────────────────────────────
if (!storage.whitelist) storage.whitelist = { users: [], servers: [] };
if (!storage.whitelist.users) storage.whitelist.users = [];
if (!storage.whitelist.servers) storage.whitelist.servers = [];
if (!storage.logs) storage.logs = {};
if (storage.logDMs === undefined) storage.logDMs = true;
if (storage.logBots === undefined) storage.logBots = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
let ChannelStore;

function getGuildId(channelId) {
	try {
		ChannelStore ??= findByStoreName("ChannelStore");
		const channel = ChannelStore.getChannel(channelId);
		return channel?.guild_id ?? null;
	} catch {
		return null;
	}
}

function shouldLog(message, guildId) {
	if (!message) return false;

	// Skip bots unless enabled
	if (message.author?.bot && !storage.logBots) return false;

	// DM check (no guildId)
	const isDM = !guildId;
	if (isDM && !storage.logDMs) return false;

	const userWhitelist = storage.whitelist.users;
	const serverWhitelist = storage.whitelist.servers;

	// If both lists are empty, log everything
	if (userWhitelist.length === 0 && serverWhitelist.length === 0) return true;

	// Check user whitelist
	if (userWhitelist.length > 0 && userWhitelist.includes(message.author?.id)) return true;

	// Check server whitelist
	if (serverWhitelist.length > 0 && !isDM && serverWhitelist.includes(guildId)) return true;

	return false;
}

function saveMessage(message, guildId) {
	try {
		const entry = {
			id: message.id,
			channelId: message.channel_id,
			guildId: guildId ?? null,
			authorId: message.author?.id ?? "unknown",
			authorUsername: message.author?.username ?? "unknown",
			authorDiscriminator: message.author?.discriminator ?? "0",
			content: message.content ?? "",
			timestamp: message.timestamp ?? new Date().toISOString(),
			attachments: (message.attachments ?? []).map((a) => a.url ?? a.filename ?? ""),
			embeds: (message.embeds ?? []).length,
			loggedAt: Date.now(),
		};
		storage.logs[message.id] = entry;
	} catch (e) {
		console.error("[MessageLogger] Failed to save message:", e);
	}
}

// ── Plugin ────────────────────────────────────────────────────────────────────
const patches = [];

export default {
	settings,

	onUnload() {
		for (const unpatch of patches) {
			try { unpatch(); } catch { /* ignore */ }
		}
	},

	onLoad() {
		try {
			// ── Patch: Catch incoming new messages ─────────────────────────────
			patches.push(
				patchBefore("dispatch", FluxDispatcher, (args) => {
					try {
						const event = args[0];
						if (!event) return;

						// New message received
						if (event.type === "MESSAGE_CREATE") {
							const message = event.message;
							if (!message?.id) return;

							const guildId = event.guildId ?? getGuildId(message.channel_id);
							if (shouldLog(message, guildId)) {
								saveMessage(message, guildId);
							}
						}

						// Bulk message create (e.g. channel history load — catches missed msgs)
						if (event.type === "MESSAGE_CREATE_BULK") {
							const messages = event.messages ?? [];
							for (const message of messages) {
								if (!message?.id) continue;
								const guildId = getGuildId(message.channel_id);
								if (shouldLog(message, guildId)) {
									saveMessage(message, guildId);
								}
							}
						}

						// Update existing logged messages if they're edited
						if (event.type === "MESSAGE_UPDATE") {
							const message = event.message;
							if (!message?.id) return;
							if (storage.logs[message.id]) {
								// Update content in log if we were already tracking this message
								const existing = storage.logs[message.id];
								existing.content = message.content ?? existing.content;
								existing.editedAt = message.edited_timestamp ?? Date.now();
								existing.editHistory = existing.editHistory ?? [];
								existing.editHistory.push({
									content: existing.content,
									at: Date.now(),
								});
								storage.logs[message.id] = existing;
							}
						}
					} catch (e) {
						console.error("[MessageLogger] Dispatch patch error:", e);
					}
				})
			);

		} catch (e) {
			console.error("[MessageLogger] onLoad failed:", e);
			alert(`[MessageLogger] Failed to load\n${e.stack}`);
		}
	},
};
