import { config } from "./config.js";
import { ContactImpl, ContactInterface, RoomImpl, RoomInterface } from "wechaty/impls";
import { Message } from "wechaty";
import { FileBox } from "file-box";
import { chatgpt, dalle, whisper } from "./openai.js";
import DBUtils from "./data.js";
import { regexpEncode } from "./utils.js";
enum MessageType {
  Unknown = 0,
  Attachment = 1, // Attach(6),
  Audio = 2, // Audio(1), Voice(34)
  Contact = 3, // ShareCard(42)
  ChatHistory = 4, // ChatHistory(19)
  Emoticon = 5, // Sticker: Emoticon(15), Emoticon(47)
  Image = 6, // Img(2), Image(3)
  Text = 7, // Text(1)
  Location = 8, // Location(48)
  MiniProgram = 9, // MiniProgram(33)
  GroupNote = 10, // GroupNote(53)
  Transfer = 11, // Transfers(2000)
  RedEnvelope = 12, // RedEnvelopes(2001)
  Recalled = 13, // Recalled(10002)
  Url = 14, // Url(5)
  Video = 15, // Video(4), Video(43)
  Post = 16, // Moment, Channel, Tweet, etc
}
const SINGLE_MESSAGE_MAX_SIZE = 500;
type Speaker = RoomImpl | ContactImpl;
interface ICommand {
  name: string;
  description: string;
  exec: (talker: Speaker, text: string) => Promise<void>;
}
export class ChatGPTBot {
  chatPrivateTriggerKeyword = config.chatPrivateTriggerKeyword;
  chatTriggerRule = config.chatTriggerRule ? new RegExp(config.chatTriggerRule) : undefined;
  disableGroupMessage = config.disableGroupMessage || false;
  botName: string = "";
  ready = false;
  setBotName(botName: string) {
    this.botName = botName;
  }
  get chatGroupTriggerRegEx(): RegExp {
    return new RegExp(`^@${regexpEncode(this.botName)}\\s`);
  }
  get chatPrivateTriggerRule(): RegExp | undefined {
    const { chatPrivateTriggerKeyword, chatTriggerRule } = this;
    let regEx = chatTriggerRule
    if (!regEx && chatPrivateTriggerKeyword) {
      regEx = new RegExp(regexpEncode(chatPrivateTriggerKeyword))
    }
    return regEx
  }
  private readonly commands: ICommand[] = [
    {
      name: "help",
      description: "显示帮助信息",
      exec: async (talker) => {
        await this.trySay(talker, "========\n" +
          "/cmd help\n" +
          "# 显示帮助信息\n" +
          "/cmd prompt <PROMPT>\n" +
          "# 设置当前会话的 prompt \n" +
          "/img <PROMPT>\n" +
          "# 根据 prompt 生成图片\n" +
          "/cmd clear\n" +
          "# 清除自上次启动以来的所有会话\n" +
          "========");
      }
    },
    {
      name: "prompt",
      description: "设置当前会话的prompt",
      exec: async (talker, prompt) => {
        if (talker instanceof RoomImpl) {
          DBUtils.setPrompt(await talker.topic(), prompt);
        } else {
          DBUtils.setPrompt(talker.name(), prompt);
        }
      }
    },
    {
      name: "clear",
      description: "清除自上次启动以来的所有会话",
      exec: async (talker) => {
        if (talker instanceof RoomImpl) {
          DBUtils.clearHistory(await talker.topic());
        } else {
          DBUtils.clearHistory(talker.name());
        }
      }
    }
  ]

  /**
   * EXAMPLE:
   *       /cmd help
   *       /cmd prompt <PROMPT>
   *       /cmd img <PROMPT>
   *       /cmd clear
   * @param contact
   * @param rawText
   */
  async command(contact: any, rawText: string): Promise<void> {
    const [commandName, ...args] = rawText.split(/\s+/);
    const command = this.commands.find(
      (command) => command.name === commandName
    );
    if (command) {
      await command.exec(contact, args.join(" "));
    }
  }
  // remove more times conversation and mention
  cleanMessage(rawText: string, privateChat: boolean = false): string {
    let text = rawText;
    const item = rawText.split("- - - - - - - - - - - - - - -");
    if (item.length > 1) {
      text = item[item.length - 1];
    }

    const { chatTriggerRule, chatPrivateTriggerRule } = this;

    if (privateChat && chatPrivateTriggerRule) {
      text = text.replace(chatPrivateTriggerRule, "")
    } else if (!privateChat) {
      text = text.replace(this.chatGroupTriggerRegEx, "")
      text = chatTriggerRule ? text.replace(chatTriggerRule, "") : text
    }
    // remove more text via - - - - - - - - - - - - - - -
    return text
  }
  async getGPTMessage(talkerName: string, text: string): Promise<string> {
    let gptMessage = await chatgpt(talkerName, text);
    if (gptMessage !== "") {
      DBUtils.addAssistantMessage(talkerName, gptMessage);
      return gptMessage;
    }
    return "Sorry, please try again later. 😔";
  }
  // Check if the message returned by chatgpt contains masked words]
  checkChatGPTBlockWords(message: string): boolean {
    if (config.chatgptBlockWords.length == 0) {
      return false;
    }
    return config.chatgptBlockWords.some((word) => message.includes(word));
  }
  // The message is segmented according to its size
  async trySay(
    talker: RoomInterface | ContactInterface,
    mesasge: string
  ): Promise<void> {
    const messages: Array<string> = [];
    if (this.checkChatGPTBlockWords(mesasge)) {
      console.log(`🚫 Blocked ChatGPT: ${mesasge}`);
      return;
    }
    let message = mesasge;
    while (message.length > SINGLE_MESSAGE_MAX_SIZE) {
      messages.push(message.slice(0, SINGLE_MESSAGE_MAX_SIZE));
      message = message.slice(SINGLE_MESSAGE_MAX_SIZE);
    }
    messages.push(message);
    for (const msg of messages) {
      await talker.say(msg);
    }
  }
  // Check whether the ChatGPT processing can be triggered
  triggerGPTMessage(text: string, privateChat: boolean = false): boolean {
    const { chatTriggerRule } = this;
    let triggered = false;
    if (privateChat) {
      const regEx = this.chatPrivateTriggerRule
      triggered = regEx ? regEx.test(text) : true;
    } else {
      triggered = this.chatGroupTriggerRegEx.test(text);
      // group message support `chatTriggerRule`
      if (triggered && chatTriggerRule) {
        triggered = chatTriggerRule.test(text.replace(this.chatGroupTriggerRegEx, ""))
      }
    }
    if (triggered) {
      console.log(`🎯 Triggered ChatGPT: ${text}`);
    }
    return triggered;
  }
  // Check whether the message contains the blocked words. if so, the message will be ignored. if so, return true
  checkBlockWords(message: string): boolean {
    if (config.blockWords.length == 0) {
      return false;
    }
    return config.blockWords.some((word) => message.includes(word));
  }
  // Filter out the message that does not need to be processed
  isNonsense(
    talker: ContactInterface,
    messageType: MessageType,
    text: string
  ): boolean {
    return (
      talker.self() ||
      // TODO: add doc support
      !(messageType == MessageType.Text || messageType == MessageType.Audio) ||
      talker.name() === "微信团队" ||
      // 语音(视频)消息
      text.includes("收到一条视频/语音聊天消息，请在手机上查看") ||
      // 红包消息
      // text.includes("收到红包，请在手机上查看") ||
      // Transfer message
      text.includes("收到转账，请在手机上查看") ||
      // 位置消息
      text.includes("/cgi-bin/mmwebwx-bin/webwxgetpubliclinkimg") ||
      // 聊天屏蔽词
      this.checkBlockWords(text)
    );
  }

  //新增自定义任务关键词
  isTaskKey(
    talker: ContactInterface,
    messageType: MessageType,
    text: string,
    room?: RoomInterface
  ): boolean {
    //文字信息
    if (messageType == MessageType.Text) {
      if (text.includes("不是大佬")
        || text.includes("学习 ")
        || text==="常用命令"
        || text.includes("收到红包，请在手机上查看")
        || DBUtils.getKnowledgeAll(text).length > 0
      ) {
        this.doTask(talker, messageType, text, room)
        return true;
      }

      
    }
    //图片信息
    if (messageType == MessageType.Image) {

    }
    //语音信息
    if (messageType == MessageType.Audio) {

    }


    return false;
  }

  async doTask(talker: ContactInterface,
    messageType: MessageType,
    text: string,
    room?: RoomInterface) {
    var resultMessage = ""

    if (text.includes("不是大佬")) {
      const level = DBUtils.getLevel(talker.name());

      if (level === null) {
        // handle null level case
        resultMessage = '';
      } else if (level > 10) {
        resultMessage = `经过您的历史发言分析：您就是大佬，大佬级别：${level}`;
      } else {
        resultMessage = `经过您的历史发言分析：您离成为群里大佬已经不远了！`;
      }
    } else if (text.startsWith("学习 ")) { //有空格
      const keyAndValue = text.substring(3);
      const key = keyAndValue.substring(0, keyAndValue.indexOf(" "));
      const value = keyAndValue.substring(key.length + 1);
      
      DBUtils.addKnowledge(key,value);

      const uid = DBUtils.getKnowledgeMapSize() + 1
      resultMessage = `感谢您提供的新知识，艾莎已记住啦,知识编号：${uid}`
    } else if (text === "常用命令") { //有空格 
      resultMessage = `
r.ScreenPercentage 200 提高渲染屏幕百分比 
r.Tonemapper.Sharpen 1 锐化画面，使画面纹理变得清晰，从而提升画面质量 
r.ForceLOD 0 将你搭建的植物模型精度强制LOD0 
foliage.ForceLOD 0  将你绘制的植物模型精度强制LOD0 
Raytracing.Geometry.InstancedstaticMeshes.Culing 0 解决绘制的植物阴影和远景处消失的问题 
r.SetNearClipPlane 1 摄像机视图裁剪 
r.DepthOfFieldQuality 4 景深质量 
r.MotionBlurQuality 4 运动模糊质量 
r.DOF.Kernel.MaxForegroundRadius 0.005 前景虚化半径 
r.DOF.Kernel.MaxBackgroundRadius 0.005 背景虚化半径 
r.DOF.Recombine.Quality 0 控制柔和程度
[以上指令感谢@${'轩'}提供]`
    }else if (text.includes("收到红包，请在手机上查看")) { //有空格
      
      resultMessage = `@${"小陈"} @${"小陈"} @${"小陈"} 老大快出来抢红包啦！！！再晚点就被这群臭小子抢完了！！ `;
    } else if (DBUtils.getKnowledgeAll(text).length > 0) { //有空格
      
      resultMessage = `${DBUtils.getKnowledge(text)}`;
    } 


    if (!room) { //私聊
      if (resultMessage && resultMessage.length > 0) {
        this.trySay(talker, resultMessage);
      }
    } else { //群聊
      if (resultMessage && resultMessage.length > 0) {
        if (!this.disableGroupMessage) {

          const result = `@${talker.name()} ${text}\n\n------\n ${resultMessage}`;
          await this.trySay(room, result);
        } else {
          return;
        }
      }
    }


  }


  async onPrivateMessage(talker: ContactInterface, text: string) {
    const gptMessage = await this.getGPTMessage(talker.name(), text);
    await this.trySay(talker, gptMessage);
  }

  async onGroupMessage(
    talker: ContactInterface,
    text: string,
    room: RoomInterface
  ) {
    const gptMessage = await this.getGPTMessage(await room.topic(), text);
    const result = `@${talker.name()} ${text}\n\n------\n ${gptMessage}`;
    await this.trySay(room, result);
  }
  async onMessage(message: Message) {
    const talker = message.talker();
    const rawText = message.text();
    const room = message.room();
    const messageType = message.type();
    const privateChat = !room;
    if (privateChat) {
      console.log(`🤵 Contact: ${talker.name()} 💬 Text: ${rawText}`)
    } else {
      const topic = await room.topic()
      console.log(`🚪 Room: ${topic} 🤵 Contact: ${talker.name()} 💬 Text: ${rawText}`)
    }
    if (this.isNonsense(talker, messageType, rawText)) {
      return;
    }
    if (messageType == MessageType.Audio) {
      // 保存语音文件
      const fileBox = await message.toFileBox();
      let fileName = "./public/" + fileBox.name;
      await fileBox.toFile(fileName, true).catch((e) => {
        console.log("保存语音失败", e);
        return;
      });
      // Whisper
      whisper("", fileName).then((text) => {
        message.say(text);
      })
      return;
    }
    if (rawText.startsWith("/cmd ")) {
      console.log(`🤖 Command: ${rawText}`)
      const cmdContent = rawText.slice(5) // 「/cmd 」一共5个字符(注意空格)
      if (privateChat) {
        await this.command(talker, cmdContent);
      } else {
        await this.command(room, cmdContent);
      }
      return;
    }
    //拦截关键词任务
    if (this.isTaskKey(talker, messageType, rawText, room)) {
      return;
    }

    // 使用DallE生成图片
    if (rawText.startsWith("/img")) {
      console.log(`🤖 Image: ${rawText}`)
      const imgContent = rawText.slice(4)
      if (privateChat) {
        let url = await dalle(talker.name(), imgContent) as string;
        const fileBox = FileBox.fromUrl(url)
        message.say(fileBox)
      } else {
        let url = await dalle(await room.topic(), imgContent) as string;
        const fileBox = FileBox.fromUrl(url)
        message.say(fileBox)
      }
      return;
    }
    if (this.triggerGPTMessage(rawText, privateChat)) {
      const text = this.cleanMessage(rawText, privateChat);
      if (privateChat) {
        return await this.onPrivateMessage(talker, text);
      } else {
        if (!this.disableGroupMessage) {
          return await this.onGroupMessage(talker, text, room);
        } else {
          return;
        }
      }
    } else {
      return;
    }
  }
}
