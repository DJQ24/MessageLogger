import { React, ReactNative } from "@vendetta/metro/common";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";
import { showConfirmationAlert } from "@vendetta/ui/alerts";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { findByStoreName, findByProps } from "@vendetta/metro";
import { showToast } from "@vendetta/ui/toasts";

let UserStore, UncachedUserManager, Profiles, GuildStore;

export default (props) => {
	UserStore ??= findByStoreName("UserStore");
	UncachedUserManager ??= findByProps("fetchProfile", "getUser", "setFlag");
	Profiles ??= findByProps("showUserProfile");
	GuildStore ??= findByStoreName("GuildStore");

	useProxy(storage);

	const [userWhitelist, setUserWhitelist] = React.useState(storage.whitelist?.users ?? []);
	const [serverWhitelist, setServerWhitelist] = React.useState(storage.whitelist?.servers ?? []);
	const [newUserId, setNewUserId] = React.useState("");
	const [newServerId, setNewServerId] = React.useState("");
	const [logCount, setLogCount] = React.useState(Object.keys(storage.logs ?? {}).length);

	async function openProfile(userId) {
		const show = Profiles.showUserProfile;
		UserStore.getUser(userId)
			? show({ userId })
			: UncachedUserManager.getUser(userId).then(({ id }) => show({ userId: id }));
	}

	function addUser() {
		const id = newUserId.trim();
		if (!id) return;
		if (!storage.whitelist.users.includes(id)) {
			storage.whitelist.users.push(id);
			setUserWhitelist([...storage.whitelist.users]);
		}
		setNewUserId("");
	}

	function removeUser(id) {
		storage.whitelist.users = storage.whitelist.users.filter((u) => u !== id);
		setUserWhitelist([...storage.whitelist.users]);
	}

	function addServer() {
		const id = newServerId.trim();
		if (!id) return;
		if (!storage.whitelist.servers.includes(id)) {
			storage.whitelist.servers.push(id);
			setServerWhitelist([...storage.whitelist.servers]);
		}
		setNewServerId("");
	}

	function removeServer(id) {
		storage.whitelist.servers = storage.whitelist.servers.filter((s) => s !== id);
		setServerWhitelist([...storage.whitelist.servers]);
	}

	function clearLogs() {
		showConfirmationAlert({
			title: "Clear All Logs",
			content: `This will permanently delete all ${logCount} logged messages. This cannot be undone.`,
			confirmText: "Clear",
			cancelText: "Cancel",
			confirmColor: "red",
			onConfirm: () => {
				storage.logs = {};
				setLogCount(0);
				showToast("All logs cleared.", getAssetIDByName("ic_trash_24px"));
			},
		});
	}

	function exportLogs() {
		const logs = storage.logs ?? {};
		const lines = [];
		for (const msgId in logs) {
			const m = logs[msgId];
			const ts = new Date(m.timestamp).toLocaleString();
			lines.push(`[${ts}] [Guild: ${m.guildId ?? "DM"}] [#${m.channelId}] ${m.authorUsername}: ${m.content}`);
			if (m.attachments?.length) lines.push(`  Attachments: ${m.attachments.join(", ")}`);
			if (m.embeds?.length) lines.push(`  Embeds: ${m.embeds}`);
		}
		showConfirmationAlert({
			title: "Log Export",
			content: lines.length
				? lines.slice(0, 30).join("\n") + (lines.length > 30 ? `\n...(${lines.length - 30} more)` : "")
				: "No logs yet.",
			confirmText: "OK",
			cancelText: "Close",
			confirmColor: "brand",
			onConfirm: () => {},
		});
	}

	return (
		<ReactNative.ScrollView style={{ flex: 1 }}>

			{/* ── Stats ── */}
			<Forms.FormSection title="Stats" titleStyleType="no_border">
				<Forms.FormRow label={`Logged messages: ${Object.keys(storage.logs ?? {}).length}`} />
				<Forms.FormRow
					label="View / Export Logs"
					trailing={<Forms.FormRow.Icon source={getAssetIDByName("ic_search_24px")} />}
					onPress={exportLogs}
				/>
				<Forms.FormRow
					label="Clear All Logs"
					trailing={<Forms.FormRow.Icon source={getAssetIDByName("ic_trash_24px")} />}
					onPress={clearLogs}
				/>
			</Forms.FormSection>

			{/* ── Options ── */}
			<Forms.FormSection title="Options">
				<Forms.FormRow
					label="Log DMs"
					trailing={
						<Forms.FormSwitch
							value={storage.logDMs}
							onValueChange={(v) => (storage.logDMs = v)}
						/>
					}
				/>
				<Forms.FormRow
					label="Log bots"
					trailing={
						<Forms.FormSwitch
							value={storage.logBots}
							onValueChange={(v) => (storage.logBots = v)}
						/>
					}
				/>
			</Forms.FormSection>

			{/* ── Whitelisted Servers ── */}
			<Forms.FormSection title="Whitelisted Servers (by Server ID)">
				<Forms.FormRow
					label="Add Server ID"
					trailing={
						<ReactNative.TextInput
							value={newServerId}
							onChangeText={setNewServerId}
							onSubmitEditing={addServer}
							placeholder="Paste server ID..."
							placeholderTextColor="#888"
							style={{ color: "#fff", minWidth: 180 }}
							keyboardType="number-pad"
						/>
					}
				/>
				<Forms.FormRow
					label="Add"
					trailing={<Forms.FormRow.Icon source={getAssetIDByName("ic_add_24px")} />}
					onPress={addServer}
				/>
				{serverWhitelist.map((id) => {
					const guild = GuildStore?.getGuild?.(id);
					const name = guild?.name ?? id;
					return (
						<Forms.FormRow
							key={id}
							label={name}
							subLabel={id}
							trailing={
								<Forms.FormRow.Icon source={getAssetIDByName("ic_trash_24px")} />
							}
							onPress={() => removeServer(id)}
						/>
					);
				})}
				{serverWhitelist.length === 0 && (
					<Forms.FormRow label="No servers whitelisted — all servers will be logged." />
				)}
			</Forms.FormSection>

			{/* ── Whitelisted Users ── */}
			<Forms.FormSection title="Whitelisted Users (by User ID)">
				<Forms.FormRow
					label="Add User ID"
					trailing={
						<ReactNative.TextInput
							value={newUserId}
							onChangeText={setNewUserId}
							onSubmitEditing={addUser}
							placeholder="Paste user ID..."
							placeholderTextColor="#888"
							style={{ color: "#fff", minWidth: 180 }}
							keyboardType="number-pad"
						/>
					}
				/>
				<Forms.FormRow
					label="Add"
					trailing={<Forms.FormRow.Icon source={getAssetIDByName("ic_add_24px")} />}
					onPress={addUser}
				/>
				{userWhitelist.map((id) => {
					const user = UserStore?.getUser?.(id);
					const name = user ? `${user.username}${user.discriminator !== "0" ? `#${user.discriminator}` : ""}` : id;
					return (
						<Forms.FormRow
							key={id}
							label={name}
							subLabel={id}
							trailing={
								<Forms.FormRow.Icon source={getAssetIDByName("ic_trash_24px")} />
							}
							onPress={() => removeUser(id)}
						/>
					);
				})}
				{userWhitelist.length === 0 && (
					<Forms.FormRow label="No users whitelisted — all users will be logged." />
				)}
			</Forms.FormSection>

			<Forms.FormSection title="How it works">
				<Forms.FormRow label="Messages are logged the moment they're received via Discord's event system — you don't need to be in the channel. Logs persist forever across restarts in plugin storage." />
			</Forms.FormSection>

		</ReactNative.ScrollView>
	);
};
