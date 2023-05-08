import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
import { User } from "./interface";
import { isTokenOverLimit } from "./utils.js";




/**
 * 使用内存作为数据库
 */

class DB {
  private static data: User[] = [];
  private static knowledge: Map<string, string> = new Map<string, string>();

  /**
   * 添加一个用户, 如果用户已存在则返回已存在的用户
   * @param username
   */
  public addUser(username: string): User {
    let existUser = DB.data.find((user) => user.username === username);
    if (existUser) {
      console.log(`用户${username}已存在`);
      return existUser;
    }
    const newUser: User = {
      username: username,
      chatMessage: [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: "ChatGPT你叫艾莎,是最优秀的UE5小助手,可以根据[https://docs.unrealengine.com/5.1/zh-CN/]官方文档回答我相关问题！"
        }
      ],
      level: 0
    };
    DB.data.push(newUser);
    return newUser;
  }

  /**
   * 根据用户名获取用户, 如果用户不存在则添加用户
   * @param username
   */
  public getUserByUsername(username: string): User {
    return DB.data.find((user) => user.username === username) || this.addUser(username);
  }

  /**
   * 获取用户的聊天记录
   * @param username
   */
  public getChatMessage(username: string): Array<ChatCompletionRequestMessage> {
    return this.getUserByUsername(username).chatMessage;
  }

  /**
   * 设置用户的prompt
   * @param username
   * @param prompt
   */
  public setPrompt(username: string, prompt: string): void {
    const user = this.getUserByUsername(username);
    if (user) {
      user.chatMessage.find(
        (msg) => msg.role === ChatCompletionRequestMessageRoleEnum.System
      )!.content = prompt;
    }
  }

  /**
   * 添加用户输入的消息
   * @param username
   * @param message
   */
  public addUserMessage(username: string, message: string): void {
    const user = this.getUserByUsername(username);
    if (user) {
      while (isTokenOverLimit(user.chatMessage)) {
        // 删除从第2条开始的消息(因为第一条是prompt)
        user.chatMessage.splice(1, 1);
      }
      user.chatMessage.push({
        role: ChatCompletionRequestMessageRoleEnum.User,
        content: message,
      });

      // 一个简单的增加大佬值的判断
      if (message.length > 10) {
        this.addLevel(username);
      }

    }
  }

  /**
   * 添加ChatGPT的回复
   * @param username
   * @param message
   */
  public addAssistantMessage(username: string, message: string): void {
    const user = this.getUserByUsername(username);
    if (user) {
      while (isTokenOverLimit(user.chatMessage)) {
        // 删除从第2条开始的消息(因为第一条是prompt)
        user.chatMessage.splice(1, 1);
      }
      user.chatMessage.push({
        role: ChatCompletionRequestMessageRoleEnum.Assistant,
        content: message,
      });
    }
  }

  /**
   * 清空用户的聊天记录, 并将prompt设置为默认值
   * @param username
   */
  public clearHistory(username: string): void {
    const user = this.getUserByUsername(username);
    if (user) {
      user.chatMessage = [
        {
          role: ChatCompletionRequestMessageRoleEnum.System,
          content: "ChatGPT你叫艾莎,是最优秀的UE5小助手,可以根据[https://docs.unrealengine.com/5.1/zh-CN/]官方文档回答我相关问题！"
        }
      ];
    }
  }

  public getAllData(): User[] {
    return DB.data;
  }

  private setLevel(username: string, level: number): void {
    const user = this.getUserByUsername(username);
    if (user) {
      user.level = level;
    }
  }

  public addLevel(username: string, num: number = 1): void {
    const userLevel = DBUtils.getLevel(username);
    if (userLevel != null) {
      DBUtils.setLevel(username, userLevel + num);
    }
  }


  public getLevel(username: string): number | null {
    const user = DBUtils.getUserByUsername(username);
    if (user) {
      return user.level;
    }
    return 0;
  }

  public getUsersStringWithLevelGreaterThanTenSortedByLevelDescending(): string {
    const users = DB.data.filter((user) => user.level > 10).sort((a,b) => b.level - a.level);
    const names = users.map((user) => user.username);
    return names.join(', ');
  }



  // Inside DB class

  /**
   * 添加一条 knowledge, 如果已存在则更新
   * @param key
   * @param knowledge
   */
  public addKnowledge(key: string, knowledge: string): void {
    const existingKnowledge = DB.knowledge.get(key);
    if (existingKnowledge) {
      knowledge = existingKnowledge + "\n" + knowledge; // append new knowledge to existing knowledge
    }
    DB.knowledge.set(key, knowledge);
  }


  public getKnowledgeAll(key: string): string[] {
    if (DB.knowledge.has(key)) {
      // If there is an exact match for the key, return the associated knowledge
      return [DB.knowledge.get(key)!];
    } else {
      // Otherwise, search for all keys that contain the given substring
      const result: string[] = [];
      for (const [k, v] of DB.knowledge.entries()) {
        if (key.includes(k)) {
          result.push(v);
        }
      }
      return result;
    }
  }



  public getKnowledge(key: string) {
    const knowledges = this.getKnowledgeAll(key);
    if (knowledges.length > 1) {
      const value = knowledges.map((k) => k.substring(k.indexOf(":") + 1).trim()).join("\n");
      return value;
    } else if (knowledges.length == 1) {
      const value = knowledges[0].substring(knowledges[0].indexOf(":") + 1).trim(); // Extract the value from the knowledge string
      return value;
    } else { 
      return '';
    }

  }


  

  public getKnowledgeMapSize(): number {
    return DB.knowledge.size;
  }





}
const DBUtils = new DB();
export default DBUtils;
