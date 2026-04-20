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

/** Register a new Meshlink account. */
export async function registerAccount(
  username: string,
  password: string,
  displayName: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getServerUrl();
  const client = sdk.createClient({ baseUrl: homeserverUrl });

  let session: MeshlinkSession;
  try {
    const resp = await client.registerRequest({
      username,
      password,
      initial_device_display_name: "Meshlink",
      auth: undefined,
    });
    session = {
      userId: resp.user_id,
      accessToken: resp.access_token!,
      deviceId: resp.device_id!,
      homeserverUrl,
    };
  } catch (err: unknown) {
    const error = err as { data?: { session?: string; error?: string; errcode?: string }; httpStatus?: number };
    if (error.httpStatus === 401 && error.data?.session) {
      try {
        const resp = await client.registerRequest({
          username,
          password,
          initial_device_display_name: "Meshlink",
          auth: {
            type: "m.login.dummy",
            session: error.data.session,
          },
        });
        session = {
          userId: resp.user_id,
          accessToken: resp.access_token!,
          deviceId: resp.device_id!,
          homeserverUrl,
        };
      } catch (err2: unknown) {
        const error2 = err2 as { data?: { error?: string; errcode?: string }; httpStatus?: number };
        const message = error2?.data?.error || "Registration failed. Please try again.";
        throw new Error(message);
      }
    } else {
      const message = error?.data?.error || "Registration failed. Check your connection.";
      throw new Error(message);
    }
  }

  if (displayName) {
    const authedClient = createClient(session);
    try {
      await authedClient.setDisplayName(displayName);
    } catch {
      /* non-critical */
    }
  }

  saveSession(session);
  return session;
}

/** Log in to an existing Meshlink account. */
export async function loginAccount(
  username: string,
  password: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getServerUrl();
  const client = sdk.createClient({ baseUrl: homeserverUrl });

  const resp = await client.login("m.login.password", {
    identifier: { type: "m.id.user", user: username },
    password,
    initial_device_display_name: "Meshlink",
  });

  const session: MeshlinkSession = {
    userId: resp.user_id,
    accessToken: resp.access_token,
    deviceId: resp.device_id,
    homeserverUrl,
  };

  saveSession(session);
  return session;
}

/** Start the client (sync with server). */
export async function startClient(client: MeshClient): Promise<void> {
  await client.startClient({ initialSyncLimit: 20 });

  return new Promise((resolve) => {
    const onSync = (state: string) => {
      if (state === "PREPARED") {
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
