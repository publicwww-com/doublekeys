/**
 * Host half of the doublekeys bundle.
 *
 * The feature is entirely browser-side (`./client`): it renders keys in the
 * composer dock slot and types into the composer through the conversation
 * plugin's public `inputActions` face. There is nothing to do on the Host, so
 * this row exists only to make the package a mounted client-plugin entry.
 */
export function apply() {}
