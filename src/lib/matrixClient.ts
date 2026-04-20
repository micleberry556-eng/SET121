/**
 * Meshlink Matrix Client
 *
 * Wraps matrix-js-sdk to provide a simple interface for the Meshlink UI.
 * Handles connection, authentication, rooms, messages, and presence.
 */

import * as sdk from "matrix-js-sdk";

// Re-export types the UI needs
export type MatrixClient = sdk.MatrixClient;
export type Room = sdk.Room;
export type MatrixEvent = sdk.MatrixEvent;
export type RoomMember = sdk.RoomMember;

export interface MeshlinkSession {
  userId: string;
  accessToken: string;
  deviceId: string;
  homeserverUrl: string;
}

const SESSION_KEY = "meshlink-session";

/** Get the homeserver URL (same origin in production). */
function getHomeserverUrl(): string {
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

/** Create a Matrix client from a stored session. */
export function createClient(session: MeshlinkSession): MatrixClient {
  return sdk.createClient({
    baseUrl: session.homeserverUrl,
    accessToken: session.accessToken,
    userId: session.userId,
    deviceId: session.deviceId,
  });
}

/** Create an unauthenticated client (for registration/login). */
export function createAnonClient(): MatrixClient {
  return sdk.createClient({ baseUrl: getHomeserverUrl() });
}

/** Register a new account. */
export async function registerAccount(
  username: string,
  password: string,
  displayName: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getHomeserverUrl();
  const client = sdk.createClient({ baseUrl: homeserverUrl });

  // Step 1: Initiate registration to get session
  let session: MeshlinkSession;
  try {
    const resp = await client.registerRequest({
      username,
      password,
      initial_device_display_name: "Meshlink",
      auth: undefined,
    });
    // If registration succeeds without auth (unlikely but possible)
    session = {
      userId: resp.user_id,
      accessToken: resp.access_token!,
      deviceId: resp.device_id!,
      homeserverUrl,
    };
  } catch (err: unknown) {
    // Expected: 401 with session for interactive auth
    const error = err as { data?: { session?: string }; httpStatus?: number };
    if (error.httpStatus === 401 && error.data?.session) {
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
    } else {
      const message = (err as { data?: { error?: string } })?.data?.error || "Registration failed";
      throw new Error(message);
    }
  }

  // Set display name
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

/** Log in to an existing account. */
export async function loginAccount(
  username: string,
  password: string,
): Promise<MeshlinkSession> {
  const homeserverUrl = getHomeserverUrl();
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
export async function startClient(client: MatrixClient): Promise<void> {
  await client.startClient({ initialSyncLimit: 20 });

  // Wait for initial sync
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
export function stopClient(client: MatrixClient): void {
  client.stopClient();
}

/** Get display name for a user. */
export function getUserDisplayName(client: MatrixClient, userId: string): string {
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

/** Check if homeserver is reachable. */
export async function checkServer(): Promise<boolean> {
  try {
    const resp = await fetch(`${getHomeserverUrl()}/_matrix/client/versions`, {
      signal: AbortSignal.timeout(5000),
    });
    return resp.ok;
  } catch {
    return false;
  }
}
