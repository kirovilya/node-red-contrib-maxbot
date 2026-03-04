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

    let isActive = true;
    let currentBot: Bot | null = null;
    let restartTimer: NodeJS.Timeout | null = null;

    const startBot = () => {
      if (!isActive) return;

      const bot = new Bot(String(configNode.token));
      currentBot = bot;

      // Обработчики событий
      const messageHandler = (ctx: any) => {
        if (!isActive) return;
        this.send({
          payload: {
            chatId: ctx.message?.recipient.chat_id,
            userId: ctx.message?.recipient.user_id,
            text: ctx.message?.body?.text,
            data: ctx.message,
            reply: (text: string) => ctx.reply(text)
          },
          topic: "max/message",
        });
      };

      const commandHandler = (ctx: any) => {
        if (!isActive) return;
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

      const actionHandler = (ctx: any) => {
        if (!isActive) return;
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

      bot.on('message_created', messageHandler);
      bot.command(/.*/, commandHandler);
      bot.action(/.*/, actionHandler);

      // Запускаем бота
      bot.start()
        .then(() => {
          if (isActive) {
            this.status({ fill: "green", shape: "dot", text: "listening" });
          }
        })
        .catch((err: any) => {
          // Ошибка во время работы или запуска
          if (!isActive) return;

          this.error(`MAX Bot error: ${err.message}`);
          this.status({ fill: "red", shape: "ring", text: "disconnected" });

          // Если это текущий бот, сбрасываем ссылку
          if (currentBot === bot) {
            currentBot = null;
          }

          // Останавливаем бота
          try { bot.stop(); } catch (e) {}

          // Планируем перезапуск
          if (restartTimer) clearTimeout(restartTimer);
          restartTimer = setTimeout(() => {
            restartTimer = null;
            if (isActive) {
              startBot();
            }
          }, 5000);
        });

      // Сразу после вызова start считаем, что бот запущен
      this.status({ fill: "green", shape: "dot", text: "listening" });
    };

    // Первый запуск
    startBot();

    this.on("close", (done: () => void) => {
      isActive = false;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (currentBot && typeof currentBot.stop === 'function') {
        try {
          currentBot.stop();
        } catch (err) {
          // ignore
        }
      }
      this.status({});
      done();
    });
  }

  RED.nodes.registerType("maxbot-receive", MaxBotReceive);
}