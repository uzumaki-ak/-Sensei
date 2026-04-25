import Pusher from "pusher";
import PusherJS from "pusher-js";

// Server-side Pusher (for broadcasting)
export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY,
  secret: process.env.PUSHER_SECRET,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  useTLS: true,
});

// Client-side Pusher (for listening)
// We use a singleton pattern for the client to avoid multiple connections
let pusherClientInstance = null;

export const getPusherClient = () => {
  if (!pusherClientInstance && typeof window !== "undefined") {
    pusherClientInstance = new PusherJS(
      process.env.NEXT_PUBLIC_PUSHER_KEY,
      {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
      }
    );
  }
  return pusherClientInstance;
};
