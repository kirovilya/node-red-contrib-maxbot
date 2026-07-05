import { NodeAPI } from "node-red";
import { Bot } from "@maxhub/max-bot-api";
import { setupMincaCertificate } from "../certs";

setupMincaCertificate();

export default function (RED: NodeAPI) {
  function MaxBotConfig(this: any, config: any) {
    RED.nodes.createNode(this, config);
    this.token = this.credentials?.token || '';

    if (this.token) {
      try {
        const bot = new Bot(this.token);
        this.status({ fill: "green", shape: "dot", text: "configured" });
      } catch (e) {
        this.status({ fill: "red", shape: "ring", text: "invalid token" });
      }
    } else {
      this.status({ fill: "red", shape: "ring", text: "missing token" });
    }
  }

  RED.nodes.registerType("maxbot-config", MaxBotConfig, {
    credentials: {
      token: { type: "text" }
    }
  });
}