import alibabaBailianIcon from '@lobehub/icons-static-svg/icons/bailian-color.svg'
import anthropicIcon from '@lobehub/icons-static-svg/icons/anthropic.svg'
import azureAiIcon from '@lobehub/icons-static-svg/icons/azureai-color.svg'
import baiduCloudIcon from '@lobehub/icons-static-svg/icons/baiducloud-color.svg'
import deepSeekIcon from '@lobehub/icons-static-svg/icons/deepseek-color.svg'
import geminiIcon from '@lobehub/icons-static-svg/icons/gemini-color.svg'
import groqIcon from '@lobehub/icons-static-svg/icons/groq.svg'
import hunyuanIcon from '@lobehub/icons-static-svg/icons/hunyuan-color.svg'
import kimiIcon from '@lobehub/icons-static-svg/icons/kimi-color.svg'
import lmStudioIcon from '@lobehub/icons-static-svg/icons/lmstudio.svg'
import minimaxIcon from '@lobehub/icons-static-svg/icons/minimax-color.svg'
import mistralIcon from '@lobehub/icons-static-svg/icons/mistral-color.svg'
import ollamaIcon from '@lobehub/icons-static-svg/icons/ollama.svg'
import openAiIcon from '@lobehub/icons-static-svg/icons/openai.svg'
import openRouterIcon from '@lobehub/icons-static-svg/icons/openrouter-color.svg'
import siliconCloudIcon from '@lobehub/icons-static-svg/icons/siliconcloud-color.svg'
import togetherIcon from '@lobehub/icons-static-svg/icons/together-color.svg'
import volcengineIcon from '@lobehub/icons-static-svg/icons/volcengine-color.svg'
import xAiIcon from '@lobehub/icons-static-svg/icons/xai.svg'
import zhipuIcon from '@lobehub/icons-static-svg/icons/zhipu-color.svg'

export interface ModelProvider {
  id: string
  name: string
  aliases: readonly string[]
  baseUrl: string
  consoleUrl: string
  icon: string | null
  monochromeIcon?: boolean
}

export const MODEL_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    aliases: ['Open AI', 'ChatGPT', 'GPT'],
    baseUrl: 'https://api.openai.com/v1',
    consoleUrl: 'https://platform.openai.com/api-keys',
    icon: openAiIcon,
    monochromeIcon: true,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    aliases: ['Claude', 'Claude API'],
    baseUrl: 'https://api.anthropic.com/v1',
    consoleUrl: 'https://console.anthropic.com/settings/keys',
    icon: anthropicIcon,
    monochromeIcon: true,
  },
  {
    id: 'google-gemini',
    name: 'Google Gemini',
    aliases: ['Gemini', 'Google AI', 'AI Studio', '谷歌 Gemini', '谷歌 AI'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    consoleUrl: 'https://aistudio.google.com/app/apikey',
    icon: geminiIcon,
  },
  {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    aliases: ['Microsoft Azure OpenAI', 'Azure AI', '微软 Azure', '微软 OpenAI'],
    baseUrl: 'https://{resource-name}.openai.azure.com/openai/v1',
    consoleUrl: 'https://ai.azure.com/',
    icon: azureAiIcon,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    aliases: ['Deep Seek', '深度求索', '深度搜索'],
    baseUrl: 'https://api.deepseek.com/v1',
    consoleUrl: 'https://platform.deepseek.com/api_keys',
    icon: deepSeekIcon,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    aliases: ['Open Router', 'OpenRouter AI'],
    baseUrl: 'https://openrouter.ai/api/v1',
    consoleUrl: 'https://openrouter.ai/settings/keys',
    icon: openRouterIcon,
  },
  {
    id: 'groq',
    name: 'Groq',
    aliases: ['GroqCloud', 'Groq Cloud'],
    baseUrl: 'https://api.groq.com/openai/v1',
    consoleUrl: 'https://console.groq.com/keys',
    icon: groqIcon,
    monochromeIcon: true,
  },
  {
    id: 'mistral-ai',
    name: 'Mistral AI',
    aliases: ['Mistral', 'Mixtral'],
    baseUrl: 'https://api.mistral.ai/v1',
    consoleUrl: 'https://console.mistral.ai/api-keys',
    icon: mistralIcon,
  },
  {
    id: 'xai',
    name: 'xAI',
    aliases: ['x.ai', 'Grok', 'Grok API'],
    baseUrl: 'https://api.x.ai/v1',
    consoleUrl: 'https://console.x.ai/',
    icon: xAiIcon,
    monochromeIcon: true,
  },
  {
    id: 'together-ai',
    name: 'Together AI',
    aliases: ['Together', 'TogetherAI', 'Together.xyz'],
    baseUrl: 'https://api.together.xyz/v1',
    consoleUrl: 'https://api.together.ai/settings/api-keys',
    icon: togetherIcon,
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    aliases: ['SiliconCloud', '硅基流动', '硅基云', '硅基'],
    baseUrl: 'https://api.siliconflow.cn/v1',
    consoleUrl: 'https://cloud.siliconflow.cn/account/ak',
    icon: siliconCloudIcon,
  },
  {
    id: 'zhipu-ai',
    name: '智谱 AI',
    aliases: ['Zhipu AI', 'Zhipu', '智谱', '智谱清言', 'BigModel', 'ChatGLM', 'GLM'],
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    consoleUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
    icon: zhipuIcon,
  },
  {
    id: 'moonshot-ai',
    name: 'Moonshot AI / Kimi',
    aliases: ['Moonshot', 'Kimi', '月之暗面', 'Kimi AI'],
    baseUrl: 'https://api.moonshot.cn/v1',
    consoleUrl: 'https://platform.moonshot.cn/console/api-keys',
    icon: kimiIcon,
  },
  {
    id: 'alibaba-bailian',
    name: '阿里云百炼',
    aliases: ['Alibaba Cloud Model Studio', '百炼', 'DashScope', '通义千问', 'Qwen', '阿里云', '阿里巴巴'],
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    consoleUrl: 'https://bailian.console.aliyun.com/',
    icon: alibabaBailianIcon,
  },
  {
    id: 'baidu-qianfan',
    name: '百度智能云千帆',
    aliases: ['百度千帆', '千帆', 'Baidu Qianfan', '百度智能云', '文心', 'Wenxin', 'ERNIE'],
    baseUrl: 'https://qianfan.baidubce.com/v2',
    consoleUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
    icon: baiduCloudIcon,
  },
  {
    id: 'volcengine-ark',
    name: '火山方舟',
    aliases: ['Volcengine Ark', 'Volcano Ark', '火山引擎', '豆包', 'Doubao', 'Ark'],
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    consoleUrl: 'https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey',
    icon: volcengineIcon,
  },
  {
    id: 'tencent-hunyuan',
    name: '腾讯混元',
    aliases: ['Tencent Hunyuan', 'Hunyuan', '腾讯云混元', '腾讯云'],
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    consoleUrl: 'https://console.cloud.tencent.com/hunyuan/api-key',
    icon: hunyuanIcon,
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    aliases: ['Mini Max', '稀宇科技', '海螺 AI', 'Hailuo AI'],
    baseUrl: 'https://api.minimaxi.com/v1',
    consoleUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key',
    icon: minimaxIcon,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    aliases: ['Ollama Local', '本地模型', '本地 API'],
    baseUrl: 'http://127.0.0.1:11434/v1',
    consoleUrl: 'https://ollama.com/search',
    icon: ollamaIcon,
    monochromeIcon: true,
  },
  {
    id: 'lm-studio',
    name: 'LM Studio',
    aliases: ['LMStudio', 'LM Studio Local', '本地模型', '本地 API'],
    baseUrl: 'http://127.0.0.1:1234/v1',
    consoleUrl: 'https://lmstudio.ai/',
    icon: lmStudioIcon,
    monochromeIcon: true,
  },
  {
    id: 'custom',
    name: '自定义厂商',
    aliases: ['自定义', '其他厂商', '其他', 'Custom', 'Custom Provider'],
    baseUrl: '',
    consoleUrl: '',
    icon: null,
  },
] as const satisfies readonly ModelProvider[]

export type ModelProviderId = (typeof MODEL_PROVIDERS)[number]['id']

export function normalizeProviderSearchText(value: string) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('zh-CN')
    .replace(/\s+/g, ' ')
}

export function getProviderHostname(value: string) {
  if (!value) return ''

  try {
    return new URL(value).host.toLocaleLowerCase('en-US')
  } catch {
    return value
      .replace(/^[a-z][a-z\d+.-]*:\/\//i, '')
      .split('/')[0]
      .toLocaleLowerCase('en-US')
  }
}

export function getModelProviderById(providerId: string | null | undefined): ModelProvider | undefined {
  const normalizedId = normalizeProviderSearchText(providerId || '')
  return MODEL_PROVIDERS.find((provider) => provider.id === normalizedId)
}

export function providerMatchesQuery(provider: ModelProvider, query: string) {
  const normalizedQuery = normalizeProviderSearchText(query)
  if (!normalizedQuery) return true

  const searchText = normalizeProviderSearchText([
    provider.id,
    provider.name,
    ...provider.aliases,
    provider.baseUrl,
    getProviderHostname(provider.baseUrl),
    provider.consoleUrl,
    getProviderHostname(provider.consoleUrl),
  ].join(' '))

  return normalizedQuery.split(' ').every((token) => searchText.includes(token))
}

export function searchModelProviders(
  query: string,
  providers: readonly ModelProvider[] = MODEL_PROVIDERS
) {
  return providers.filter((provider) => providerMatchesQuery(provider, query))
}
