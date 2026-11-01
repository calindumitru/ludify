// What the deck player and the narrowing form need to know about the host they run in.
import type { App } from '@modelcontextprotocol/ext-apps/app-with-deps';

/** Claude puts a message an app sends into the user's message box, for them to send with Enter;
 * other hosts (ChatGPT) send it at once. */
export const fillsComposer = (app: App) => /claude/i.test(app.getHostVersion()?.name ?? '');
