// Wire-level result codes shared by the renderer (lib/agent-client) and
// Electron main (rpc-manager, the agent service). A module of its own so
// neither side pulls the other into its bundle: rpc-manager's graph is
// node-only, agent-client's is browser-only.

/**
 * A command refused for an extension's error that pi's runner already reported
 * as an `extension_error` event (a `user_bash` handler that threw): the page
 * shows that event's notice, so the refusal adds none.
 */
export const EXTENSION_REPORTED_CODE = "extension_reported";
