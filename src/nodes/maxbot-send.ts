import { NodeAPI, Node } from "node-red";
import { Bot, Keyboard } from "@maxhub/max-bot-api";

interface MaxBotConfigNode extends Node {
  token: string;
}

export default function (RED: NodeAPI) {
  function MaxBotSend(this: any, config: any) {
    RED.nodes.createNode(this, config);

    const configId = config.bot;
    if (!configId) {
      this.error("No MAX bot configuration selected");
      this.status({ fill: "red", shape: "ring", text: "no config" });
      return;
    }

    const configNode = RED.nodes.getNode(configId) as MaxBotConfigNode | null;
    if (!configNode || !configNode.token) {
      this.error("MAX bot token is not configured");
      this.status({ fill: "red", shape: "ring", text: "invalid config" });
      return;
    }

    const bot = new Bot(String(configNode.token));

    this.on("input", async (msg: any, send: any, done: any) => {
      try {
        const commands = msg.commands;
        const deleteId = msg.deleteId || msg.payload?.deleteId;
        const chatId = msg.chatId || config.defaultChatId;
        const userId = msg.userId;
        if (!chatId && !userId && !deleteId && !commands) {
          throw new Error("chatId/userId/deleteId is not provided (set in msg.chatId/msg.userId/msg.deleteId, node config)");
        }

        let text = '';
        if (typeof msg.payload === 'object') {
          text = msg.payload.text;
        } else {
          text =  msg.payload?.toString() || '';
        }
        if (!text && !deleteId && !commands) {
          throw new Error("message text is empty (msg.payload)");
        }

        this.status({ fill: "blue", shape: "ring", text: "sending..." });

        let result;
        if (deleteId) {
          result = await bot.api.deleteMessage(deleteId);
        } else if (commands) {
          result = await bot.api.setMyCommands(commands);
        } else {
          const extra = (typeof msg.payload === 'object') ? msg.payload : undefined;
          result = (!chatId && userId) ? 
            await bot.api.sendMessageToUser(userId, text, extra) :
            await bot.api.sendMessageToChat(chatId, text, extra);
        }

        this.status({ fill: "green", shape: "dot", text: "sent" });
        msg.payload = result;

        if (this.outputs === 2) {
          send([msg, null]);
        } else {
          send(msg);
        }
        done();
      } catch (err: any) {
        this.status({ fill: "red", shape: "ring", text: "error" });
        if (this.outputs === 2) {
          msg.error = err;
          send([null, msg]);
        } else {
          this.error(err, msg);
        }
        done();
      }
    });

    this.on("close", () => {
      this.status({});
    });
  }

  RED.nodes.registerType("maxbot-send", MaxBotSend);
}