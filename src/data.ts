import { ChatCompletionRequestMessage, ChatCompletionRequestMessageRoleEnum } from "openai";
import { User } from "./interface";
import { isTokenOverLimit } from "./utils.js";


import { users } from "wechaty";


import AV from 'leancloud-storage';
const { Query, User } = AV;



/**
 * 使用内存作为数据库
 */

class DB {
  private static data: User[] = [];
  private static wikis: Wiki[] = [];

  constructor() {
    //加载LC数据库
    AV.init({
      appId: "njhD5QtcCps1XH3ZZwu9wg04-gzGzoHsz",
      appKey: "Q40JsKQ2zsPQBDHdfSpQyAQj",
      serverURL: "https://njhd5qtc.lc-cn-n1-shared.com",
    });

    const query = new AV.Query("Wikis");
    query.limit(1000)
    query.find().then((datas) => {

      datas.forEach((item: any) => {
        DB.wikis.push({
          user: item.get("user"),
          key: item.get("key"),
          value: item.get("value")
        });
      });
    });


    //
    const user_query = new AV.Query("DBUser");
    user_query.limit(1000)
    user_query.find().then((datas) => {

      datas.forEach((item: any) => {
        DB.data.push({
          username: item.get("username"),
          chatMessage: [
            {
              role: ChatCompletionRequestMessageRoleEnum.System,
              content: "ChatGPT你叫艾莎,是最优秀的UE5小助手,可以根据[https://docs.unrealengine.com/5.1/zh-CN/]官方文档回答我相关问题！"
            }
          ],
          level: item.get("level")
        });
      });
    });

  }



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

    //添加到服务器
    // 声明 class
    const Todo = AV.Object.extend("DBUser");
    // 构建对象
    const todo = new Todo();
    // 为属性赋值
    todo.set("username", username);
    todo.set("level", 0);
    // 将对象保存到云端
    todo.save().then(
      (todo) => {
        // 成功保存之后，执行其他逻辑
        console.log(`保存成功。objectId：${todo.id}`);
      },
      (error) => {
        // 异常处理
      }
    );






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
    const users = DB.data.filter((user) => user.level > 10)
      .sort((a, b) => b.level - a.level)
      .slice(0, 10);
    const usernames = users.map((user) => user.username);

    return usernames.join(', ');
  }



  // Inside DB class

  /**
   * 添加一条 knowledge, 如果已存在则更新
   * @param key
   * @param knowledge
   */
  public addWiki(username: string, key: string, value: string): void {

    const newWiki: Wiki = {
      user: username,
      key: key,
      value: value
    };
    DB.wikis.push(newWiki);


    //添加到服务器
    // 声明 class
    const Todo = AV.Object.extend("Wikis");
    // 构建对象
    const todo = new Todo();
    // 为属性赋值
    todo.set("user", username);
    todo.set("key", key);
    todo.set("value", value);
    // 将对象保存到云端
    todo.save().then(
      (todo) => {
        // 成功保存之后，执行其他逻辑
        console.log(`保存成功。objectId：${todo.id}`);
      },
      (error) => {
        // 异常处理
      }
    );
  }






  public getWikis(key: string): string {
    const wikis = this.getWikisByKey(key);
    const wikiStringArray = wikis.map(wiki => `[${wiki.key}]\n${wiki.value}\n[--以上内容由 @${wiki.user}  佬贡献]`);
    return wikiStringArray.join('\n\n');
  }


  private getWikisByKey(key: string): Wiki[] {
    return DB.wikis.filter(wiki => wiki.key === key);
  }


  public getAllWikisKeys(): string { 
    const keys = DB.wikis.map((wiki, index) => `${index + 1}.${wiki.key}`);
    return "目前已录入以下知识库，可以直接输入标题返回内容\n\n" + keys.join('\n');
  }


  public getWikisSizeForKey(key: string): number {
    if(key!=null&&key.length>0){
      return this.getWikisByKey(key).length;
    }
    return 0;
  }

  public getWikisSize(): number {
    return DB.wikis.length;
  }





}
const DBUtils = new DB();
export default DBUtils;
export interface Wiki {
  user: string,
  key: string,
  value: string
}
