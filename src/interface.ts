import {ChatCompletionRequestMessage} from "openai";

export interface IConfig {
  api?: string;
  openai_api_key: string;
  model: string;
  chatTriggerRule: string;
  disableGroupMessage: boolean;
  temperature: number;
  blockWords: string[];
  chatgptBlockWords: string[];
  chatPrivateTriggerKeyword: string;
}
export interface User {
  username: string,
  chatMessage: Array<ChatCompletionRequestMessage>,
  level: number; // Add a level property to the interface
}

//知识库
export interface Knowledge {
  username: string,
  content: string,
  score: number; // 评分
}
