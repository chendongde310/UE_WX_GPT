<h1 align="center">欢迎使用 ue_gpt 👋</h1>
 

> 在微信上接入 为UE开发者定制的ChatGPT
> [原来项目地址](https://github.com/fuergaosi233/wechat-chatgpt/blob/main/README_ZH.md) | 中文文档

## 📝 Environment Variables

| name                     | default                | example                                        | description                                                 |
|--------------------------|------------------------|------------------------------------------------|-------------------------------------------------------------|
| API                      | https://api.openai.com |                                                | 自定义ChatGPT API 地址                                           |
| OPENAI_API_KEY           | 123456789              | sk-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX | [创建你的 API 密钥](https://platform.openai.com/account/api-keys) |
| MODEL                    | gpt-3.5-turbo          |                                                | 要使用的模型ID, 目前仅支持`gpt-3.5-turbo` 和 `gpt-3.5-turbo-0301`       |
| TEMPERATURE              | 0.6                    |                                                | 在0和2之间。较高的数值如0.8会使 ChatGPT 输出更加随机，而较低的数值如0.2会使其更加稳定。        |
| CHAT_TRIGGER_RULE        |                        |                                                | 私聊触发规则                                                      |
| DISABLE_GROUP_MESSAGE    | true                   |                                                | 禁用在群聊里使用ChatGPT                                             |
| CHAT_PRIVATE_TRIGGER_KEYWORD |                        |                                                | 在私聊中触发ChatGPT的关键词, 默认是无需关键词即可触发                             |
| BLOCK_WORDS              | "VPN"                  | "WORD1,WORD2,WORD3"                            | 聊天屏蔽关键词(同时在群组和私聊中生效, 避免 bot 用户恶意提问导致封号                      |
| CHATGPT_BLOCK_WORDS      | "VPN"                  | "WORD1,WORD2,WORD3"                            | ChatGPT回复屏蔽词, 如果ChatGPT的回复中包含了屏蔽词, 则不回复                     |

# 

## ⌨️ 命令
> 在微信聊天框中输入
```shell
/cmd help # 显示帮助信息
/cmd prompt <PROMPT> # 设置ChatGPT Prompt
/cmd clear # 清除WeChat-ChatGPT保存的会话记录
```

 