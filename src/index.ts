import { NodeAPI } from "node-red";
import { setupMincaCertificate } from "./certs";

setupMincaCertificate();

import maxbotConfig from "./nodes/maxbot-config";
import maxbotSend from "./nodes/maxbot-send";
import maxbotReceive from "./nodes/maxbot-receive";

module.exports = function (RED: NodeAPI) {
  maxbotConfig(RED);
  maxbotSend(RED);
  maxbotReceive(RED);
};