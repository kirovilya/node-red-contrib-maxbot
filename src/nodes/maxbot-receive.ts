import { NodeAPI, Node } from "node-red";
import { Bot } from "@maxhub/max-bot-api";

interface MaxBotConfigNode extends Node {
  token: string;
}

export default function (RED: NodeAPI) {
  function MaxBotReceive(this: any, config: any) {
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
    const handlers: Array<{ event: string; handler: (...args: any[]) => void }> = [];

    // Обработчик всех сообщений
    const messageHandler = (ctx: any) => {
      this.send({
        payload: {
          chatId: ctx.message?.recipient.chat_id,
          userId: ctx.message?.recipient.user_id,
          text: ctx.message?.body?.text,
          data: ctx.message,
          reply: (text: string) => ctx.reply(text) // Передаём возможность ответа
        },
        topic: "max/message",
      });
    };

    // Обработчик команд
    const commandHandler = (ctx: any) => {
      this.send({
        payload: {
          chatId: ctx.message?.recipient.chat_id,
          userId: ctx.message?.recipient.user_id,
          command: ctx.match[0],
          data: ctx.message,
          reply: (text: string) => ctx.reply(text)
        },
        topic: "max/command",
      });
    };

    // Обработчик действий
    const actionHandler = (ctx: any) => {
      this.send({
        payload: {
          chatId: ctx.message?.recipient.chat_id,
          userId: ctx.message?.recipient.user_id,
          action: ctx.match[0],
          data: ctx.message,
          reply: (text: string) => ctx.reply(text)
        },
        topic: "max/action",
      });
    };

    // Подписываемся на события
    bot.on('message_created', messageHandler);
    bot.command(/.*/, commandHandler);
    bot.action(/.*/, actionHandler);

    handlers.push(
      { event: 'message_created', handler: messageHandler }
    );

    // Запускаем бота
    bot.start().then(() => {
      this.log("MAX Bot started listening");
      this.status({ fill: "green", shape: "dot", text: "listening" });
    }).catch((err: any) => {
      this.error("Failed to start bot: " + err.message);
      this.status({ fill: "red", shape: "ring", text: "start failed" });
    });

    this.on("close", (done: () => void) => {
      // Остановка бота, если есть метод stop
      if (typeof bot.stop === 'function') {
        bot.stop();
      }
      // В библиотеке может не быть off, поэтому просто сбрасываем статус
      this.status({});
      done();
    });
  }

  RED.nodes.registerType("maxbot-receive", MaxBotReceive);
}