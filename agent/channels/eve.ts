import { localDev, vercelOidc } from "eve/channels/auth";
import { eveChannel } from "eve/channels/eve";

const localDevAuth = localDev();

export default eveChannel({
  auth: [localDevAuth, vercelOidc()],
});
