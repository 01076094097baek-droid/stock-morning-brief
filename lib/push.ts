import webPush from "web-push";
import { kvGetPushSubs, kvRemovePushSub } from "./kv";

function setupVapid() {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL || "mailto:admin@example.com";
  if (pub && priv) webPush.setVapidDetails(email, pub, priv);
}

export async function sendBriefingPush(title: string, body: string): Promise<void> {
  setupVapid();
  const subs = await kvGetPushSubs();
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body });

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          payload
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await kvRemovePushSub(sub.endpoint);
        }
      }
    })
  );
}
