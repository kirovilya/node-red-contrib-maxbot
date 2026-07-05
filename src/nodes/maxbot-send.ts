import { NodeAPI, Node } from "node-red";
import { Bot, ImageAttachment, VideoAttachment, FileAttachment, AudioAttachment } from "@maxhub/max-bot-api";
import { setupMincaCertificate, httpsFetch, createMultipartBody } from "../certs";

setupMincaCertificate();

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
        let attachments;
        if (typeof msg.payload === 'object') {
          text = msg.payload.text || '';
          const mediaType = msg.payload.type;
          const source = msg.payload.source;
          if (mediaType && source) {
            const isUrl = typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'));
            let attachment;
            if (mediaType === 'image') {
              if (isUrl) {
                attachment = new ImageAttachment({ url: source });
              } else {
                const result = await bot.api.upload.image({ source });
                if ('url' in result) {
                  attachment = new ImageAttachment({ url: result.url });
                } else if ('photos' in result) {
                  attachment = new ImageAttachment({ photos: result.photos });
                } else {
                  attachment = new ImageAttachment({ token: (result as any).token });
                }
              }
            } else if (mediaType === 'video') {
              if (isUrl) {
                const response = await httpsFetch(source);
                if (!response.ok) {
                  throw new Error(`Failed to download video from URL: ${response.status} ${response.statusText}`);
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                const uploadRes = await bot.api.raw.uploads.getUploadUrl({ type: 'video' });
                const { url: uploadUrl, token: videoToken } = uploadRes;
                await httpsFetch(uploadUrl, {
                  method: 'POST',
                  multipartBody: createMultipartBody('data', buffer, 'video.mp4'),
                });
                attachment = new VideoAttachment({ token: videoToken });
              } else {
                const result = await bot.api.upload.video({ source });
                attachment = new VideoAttachment({ token: result.token });
              }
            } else if (mediaType === 'file') {
              if (isUrl) {
                const response = await httpsFetch(source);
                if (!response.ok) {
                  throw new Error(`Failed to download file from URL: ${response.status} ${response.statusText}`);
                }
                const buffer = await response.arrayBuffer();
                const result = await bot.api.upload.file({ source: Buffer.from(buffer) });
                attachment = new FileAttachment({ token: result.token });
              } else {
                const result = await bot.api.upload.file({ source });
                attachment = new FileAttachment({ token: result.token });
              }
            } else if (mediaType === 'audio') {
              if (isUrl) {
                const response = await httpsFetch(source);
                if (!response.ok) {
                  throw new Error(`Failed to download audio from URL: ${response.status} ${response.statusText}`);
                }
                const buffer = Buffer.from(await response.arrayBuffer());
                const uploadRes = await bot.api.raw.uploads.getUploadUrl({ type: 'audio' });
                const { url: uploadUrl, token: audioToken } = uploadRes;
                await httpsFetch(uploadUrl, {
                  method: 'POST',
                  multipartBody: createMultipartBody('data', buffer, 'audio.mp3'),
                });
                attachment = new AudioAttachment({ token: audioToken });
              } else {
                const result = await bot.api.upload.audio({ source });
                attachment = new AudioAttachment({ token: result.token });
              }
            }
            if (attachment) {
              attachments = [attachment.toJson()];
            }
          }
        } else {
          text = msg.payload?.toString() || '';
        }
        if (!text && !deleteId && !commands && !attachments) {
          throw new Error("message text is empty (msg.payload)");
        }

        this.status({ fill: "blue", shape: "ring", text: "sending..." });

        let result;
        if (deleteId) {
          result = await bot.api.deleteMessage(deleteId);
        } else if (commands) {
          result = await bot.api.setMyCommands(commands);
        } else {
          let extra;
          if (typeof msg.payload === 'object') {
            extra = { ...msg.payload };
            if (attachments) {
              extra.attachments = attachments;
            }
          }
          result = (!chatId && userId)
            ? await bot.api.sendMessageToUser(userId, text, extra)
            : await bot.api.sendMessageToChat(chatId, text, extra);
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
