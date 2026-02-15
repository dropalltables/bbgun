# bbgun

Drop-in replacement for `@photon-ai/advanced-imessage-kit` backed by [BlueBubbles Server](https://bluebubbles.app).

Same method signatures, same types, same events. Change the import, point `serverUrl` at your BlueBubbles instance, pass your server password as `apiKey`.

## Usage

```ts
import { SDK } from "bbgun";

const sdk = SDK({
  serverUrl: "http://localhost:1234",
  apiKey: "your-bluebubbles-password",
});

await sdk.connect();

sdk.on("new-message", (message) => {
  console.log(message.text);
});

await sdk.messages.sendMessage({
  chatGuid: "iMessage;-;+15551234567",
  message: "hello from bbgun",
});
```

## Migration

```diff
-import { AdvancedIMessageKit, SDK } from "@photon-ai/advanced-imessage-kit";
+import { BBGun, SDK } from "bbgun";
```

`SDK()`, all module methods (`.messages`, `.chats`, `.attachments`, `.contacts`, `.handles`, `.facetime`, `.icloud`, `.polls`, `.scheduledMessages`, `.server`), event names, and types are identical.

## What differs internally

- REST auth uses BlueBubbles' `password` query param instead of `X-API-Key` header
- Socket.IO handshake sends `{ password }` instead of `{ apiKey }`
- Live photo download path: `/attachment/:guid/download/live`
- Contact lookup uses `POST /contact/query` with `{ addresses }` body
- No `reflect-metadata`, `sharp`, `consola`, or `zod` dependencies

## License

AGPL-3.0
