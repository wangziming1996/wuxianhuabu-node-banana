/**
 * 10 个工作流预设 — 复刻 Node Banana 的具体模板
 * 每个预设带主 prompt、推荐模型、目标大小
 */
import type { WorkflowPreset } from '../types'

export const WORKFLOW_PRESETS: WorkflowPreset[] = [
  {
    id: 'pro-design',
    category: '设计',
    title: '专业设计',
    description: '高质量出图 · 文字渲染 / 品牌色 / 一致性(万相 2.7 Pro 风格)',
    prompt:
      '高级商业广告摄影风格,精准布光,柔和主光,细腻边缘高光,真实材质反射,干净背景,克制阴影,超写实产品细节,杂志级修图。不添加文字、标志、水印或 UI 元素。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '4:3',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'cn-poster',
    category: '海报',
    title: '中文海报',
    description: '中文文字渲染最佳 · 支持负向词(千问 2.0 Pro 风格)',
    prompt:
      '海报级中文排版,标题字号大,信息层级清晰,留白合理,主体居中,辅助元素分布均衡。文字要准确可读、无错字、无乱码。负向词:不出现英文字母、不出现水印。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '3:4',
    count: 1,
    presetFor: ['image', 'custom'],
  },
  {
    id: 'quick-sketch',
    category: '草图',
    title: '快速草图',
    description: '极速低成本 · 写实人像 / 产品(Z-Image Turbo 风格)',
    prompt: '简化版快速出图,主体明确,背景简洁,色调统一,不追求极致细节但保留识别度。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '1:1',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'image-retouch',
    category: '精修',
    title: '图片精修',
    description: '在原图上精修 / 重绘(万相 2.7 Pro 改图风格)',
    prompt:
      '保留原图布局、构图、配色、角色身份和主要场景元素不变。只在指定区域里精修或重绘,其他区域必须像素级一致。不添加新元素、不删除已有元素、不改变画幅比例。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '1:1',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'text-edit',
    category: '改图',
    title: '文字改图',
    description: '按文字指令改图(千问 2.0 Pro 改图风格)',
    prompt:
      '完全按照用户文字指令对参考图进行修改。改图后保持原图主体内容、风格、构图不变,只在指定位置执行变更。最终输出与文字指令严格一致。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '1:1',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'character-triptych',
    category: '角色',
    title: '角色三视图',
    description: '基于参考图角色生成正面、侧面、背面三视图设定稿',
    prompt:
      '以参考图为基准,生成该角色的 16:9 角色设定三视图:正面、3/4 侧面、背面。角色身份、五官、发型、体型、气质、服装与参考图严格一致。专业角色设计稿风格,统一背景色,各视图对齐,无遮挡。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '16:9',
    count: 1,
    presetFor: ['character'],
  },
  {
    id: 'story-outline',
    category: '剧情',
    title: '剧情梗概',
    description: '基于剧情走向生成单张剧情梗概图(电影剧照风格)',
    prompt:
      '根据用户剧情梗概描述,生成一张电影剧照风格的高质量画面。主体居中、画面情绪饱满、灯光与构图服务于故事氛围,不使用文字、不出现水印。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '16:9',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'story-progression-4',
    category: '剧情',
    title: '时间推演 4 格',
    description: '同一主体 + 4 个时间点的画面,排成 2x2',
    prompt:
      '在 16:9 画幅内整齐排列 4 张 2x2 网格图,展示同一主体在 4 个不同时间点或情绪阶段的状态。主体身份、风格在每张图保持一致,只是表情 / 姿态 / 色调 / 道具随时间推进。统一构图风格,4 张图视觉对齐,无文字水印。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '16:9',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'storyboard-grid-9',
    category: '分镜',
    title: '故事九宫格',
    description: '3x3 漫画分镜,展示一段叙事的连续镜头',
    prompt:
      '在 16:9 画幅内整齐排列 9 张 3x3 漫画分镜图,讲述一段连贯的叙事。同一组角色贯穿全部镜头。每格保留漫画风格的构图、视角、光影变化,以及适当的场景变化。文风克制不喧宾夺主。',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '16:9',
    count: 1,
    presetFor: ['image'],
  },
  {
    id: 'motion-transfer',
    category: '设计',
    title: '动作迁移',
    description: '图 1 锁定形象,图 2 只提供动作姿态',
    prompt:
      'Motion transfer workflow.\n[Figure-1] is the identity figure — face, hair, body shape, outfit, art style, color palette MUST be preserved exactly.\n[Figure-2] is the motion figure — only its body pose, gesture, and orientation should be referenced; ignore its identity, clothing, and background entirely.\nGenerate a new image where Figure-1 adopts Figure-2\'s pose and motion, with Figure-1\'s complete identity. Background should be a simple clean studio environment. No text, no logos, no watermark.',
    recommendedModel: 'agnes-image-2.0-flash',
    size: '1:1',
    count: 1,
    presetFor: ['image'],
  },
]

export const PRESETS_BY_ID = Object.fromEntries(WORKFLOW_PRESETS.map((p) => [p.id, p]))
