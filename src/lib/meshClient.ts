/**
 * Meshlink Client
 *
 * Core networking layer for the Meshlink social platform.
 * Handles connection, authentication, rooms, messages, and presence.
 */

import * as sdk from "matrix-js-sdk";

// Re-export internal types under Meshlink names
export type MeshClient = sdk.MatrixClient;
export type MeshRoom = sdk.Room;
export type MeshEvent = sdk.MatrixEvent;
export type MeshMember = sdk.RoomMember;

export interface MeshlinkSession {
  userId: string;
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
}

const SESSION_KEY = "meshlink-session";

/** Get the server URL (same origin in production). */
function getServerUrl(): string {
  return window.location.origin;
}

/** Store session to localStorage. */
export function saveSession(session: MeshlinkSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

/** Load session from localStorage. */
export function loadSession(): MeshlinkSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return null;
}

/** Clear session. */
export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

/** Create an authenticated client from a stored session. */
export function createClient(session: MeshlinkSession): MeshClient {
  return sdk.createClient({
    baseUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
  });
}

/** Create an unauthenticated client (for registration/login). */
export function createAnonClient(): MeshClient {
  return sdk.createClient({ baseUrl: getServerUrl() });
}

/**
 * Register a new Meshlink account.
 * Uses raw fetch for reliability (SDK registerRequest has inconsistent error handling).
 */
export async function registerAccount(
  username: string,
  password: string,
  displayName: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getServerUrl();
  const registerUrl = `${homeserverUrl}/_matrix/client/v3/register`;

  // Step 1: Get auth session
  const initResp = await fetch(registerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  const initData = await initResp.json();

  // If server returned an error (not 401 auth flow)
  if (!initResp.ok && initResp.status !== 401) {
    throw new Error(initData.error || `Registration failed (${initResp.status})`);
  }

  // If registration succeeded without auth (unlikely but handle it)
  if (initResp.ok && initData.access_token) {
    const session: MeshlinkSession = {
      userId: initData.user_id,
      accessToken: initData.access_token,
      deviceId: initData.device_id,
      homeserverUrl,
    };
    await trySetDisplayName(session, displayName);
    saveSession(session);
    return session;
  }

  // Step 2: Complete registration with dummy auth
  const authSession = initData.session;
  if (!authSession) {
    throw new Error("Server did not return auth session. Registration may be disabled.");
  }

  const regResp = await fetch(registerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      initial_device_display_name: "Meshlink",
      auth: {
        type: "m.login.dummy",
        session: authSession,
      },
    }),
  });

  const regData = await regResp.json();

  if (!regResp.ok) {
    throw new Error(regData.error || `Registration failed (${regResp.status})`);
  }

  const session: MeshlinkSession = {
    userId: regData.user_id,
    accessToken: regData.access_token,
    deviceId: regData.device_id,
    homeserverUrl,
  };

  await trySetDisplayName(session, displayName);
  saveSession(session);
  return session;
}

/** Set display name (non-critical, don't throw). */
async function trySetDisplayName(session: MeshlinkSession, displayName: string): Promise<void> {
  if (!displayName) return;
  try {
    await fetch(
      `${session.homeserverUrl}/_matrix/client/v3/profile/${encodeURIComponent(session.userId)}/displayname`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({ displayname: displayName }),
      },
    );
  } catch {
    /* non-critical */
  }
}

/** Log in to an existing Meshlink account. */
export async function loginAccount(
  username: string,
  password: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getServerUrl();

  const resp = await fetch(`${homeserverUrl}/_matrix/client/v3/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "m.login.password",
      identifier: { type: "m.id.user", user: username },
      password,
      initial_device_display_name: "Meshlink",
    }),
  });

  const data = await resp.json();

  if (!resp.ok) {
    throw new Error(data.error || `Login failed (${resp.status})`);
  }

  const session: MeshlinkSession = {
    userId: data.user_id,
    accessToken: data.access_token,
    deviceId: data.device_id,
    homeserverUrl,
  };

  saveSession(session);
  return session;
}

/** Start the client (sync with server). */
export async function startClient(client: MeshClient): Promise<void> {
  await client.startClient({ initialSyncLimit: 50 });

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      client.removeListener(sdk.ClientEvent.Sync, onSync);
      resolve();
    }, 15000);

    const onSync = (state: string) => {
      if (state === "PREPARED") {
        clearTimeout(timeout);
        client.removeListener(sdk.ClientEvent.Sync, onSync);
        resolve();
      }
    };
    client.on(sdk.ClientEvent.Sync, onSync);
  });
}

/** Stop the client. */
export function stopClient(client: MeshClient): void {
  client.stopClient();
}

/** Get display name for a user. */
export function getUserDisplayName(client: MeshClient, userId: string): string {
  const user = client.getUser(userId);
  return user?.displayName || userId.split(":")[0].replace("@", "");
}

/** Get initials from a display name. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "??";
}

/** Check if Meshlink server is reachable. */
export async function checkServer(): Promise<boolean> {
  try {
    const resp = await fetch(`${getServerUrl()}/_matrix/client/versions`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/** Upload a file to the server. Returns the mxc:// URI. */
export async function uploadMedia(
  accessToken: string,
  file: File,
): Promise<string> {
  const resp = await fetch(`${getServerUrl()}/_matrix/media/v3/upload?filename=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      Authorization: `Bearer ${accessToken}`,
    },
    body: file,
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `Upload failed (${resp.status})`);
  }

  const data = await resp.json();
  return (data as { content_uri: string }).content_uri;
}

/** Convert an mxc:// URI to an HTTP URL for display. */
export function mxcToUrl(mxcUri: string): string {
  if (!mxcUri || !mxcUri.startsWith("mxc://")) return mxcUri;
  const parts = mxcUri.replace("mxc://", "").split("/");
  if (parts.length < 2) return mxcUri;
  const serverName = parts[0];
  const mediaId = parts.slice(1).join("/");
  return `${getServerUrl()}/_matrix/media/v3/download/${serverName}/${mediaId}`;
}

/** Convert an mxc:// URI to a thumbnail URL. */
export function mxcToThumbnail(mxcUri: string, width = 640, height = 480): string {
  if (!mxcUri || !mxcUri.startsWith("mxc://")) return mxcUri;
  const parts = mxcUri.replace("mxc://", "").split("/");
  if (parts.length < 2) return mxcUri;
  const serverName = parts[0];
  const mediaId = parts.slice(1).join("/");
  return `${getServerUrl()}/_matrix/media/v3/thumbnail/${serverName}/${mediaId}?width=${width}&height=${height}&method=scale`;
}
