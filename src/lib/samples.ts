import type { Repo } from './repo';

/** A few starter prompts so a new user can try the full flow in under a minute. */
export async function seedSamples(repo: Repo): Promise<void> {
  const writing = await repo.createFolder('写作助手');
  const coding = await repo.createFolder('代码开发');
  const marketing = await repo.createFolder('营销文案');

  await repo.createPrompt({
    title: '周报生成器',
    description: '根据本周工作要点生成「完成 / 风险 / 计划」三段式周报',
    folderId: writing.id,
    tags: ['职场', '结构化输出'],
    models: ['通用'],
    shortcut: 'zb',
    isFavorite: true,
    content: [
      '你是一位擅长总结的职场写作助手。',
      '请根据以下本周工作要点，为 {{姓名}} 撰写一份 {{风格}} 风格的周报（日期：{{@今天}}）。',
      '工作要点：',
      '{{工作要点}}',
      '要求：',
      '1. 分为「本周完成」「问题与风险」「下周计划」三部分',
      '2. 每部分不超过 5 条，语言简洁',
      '3. 尽量量化成果，突出业务价值',
    ].join('\n'),
    variables: [
      { name: '姓名', type: 'text', default: '', options: [] },
      { name: '风格', type: 'select', default: '简洁', options: ['简洁', '正式', '活泼'] },
      { name: '工作要点', type: 'textarea', default: '', options: [] },
    ],
  });

  await repo.createPrompt({
    title: '代码审查助手',
    description: '以资深工程师视角审查代码，按严重程度列出问题与修改建议',
    folderId: coding.id,
    tags: ['代码'],
    models: ['通用'],
    shortcut: 'cr',
    content: [
      '你是一名资深 {{语言}} 工程师，请审查下面的代码：',
      '',
      '{{@剪贴板}}',
      '',
      '请按「严重 / 一般 / 建议」三个级别列出问题，每条给出原因和修改后的代码。',
    ].join('\n'),
    variables: [{ name: '语言', type: 'select', default: 'TypeScript', options: ['TypeScript', 'Python', 'Go', 'Java'] }],
  });

  await repo.createPrompt({
    title: '小红书标题生成',
    description: '输入产品和卖点，生成 5 条小红书风格标题',
    folderId: marketing.id,
    tags: ['营销', '小红书'],
    models: ['通用'],
    shortcut: 'xhs',
    content:
      '你是一名资深电商文案。请为 {{产品}} 写 5 条小红书风格的标题，每条不超过 20 字，突出 {{卖点}} 这个卖点，语气活泼，带 1–2 个话题标签。',
  });
}
