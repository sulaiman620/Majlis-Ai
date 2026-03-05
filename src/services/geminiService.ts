import { Agent, Language, Style } from "../constants";

const API_KEY = (import.meta as any).env?.VITE_OPENROUTER_API_KEY || "";
const MODEL = "google/gemini-2.5-flash-lite"; // openai/gpt-4o

async function chatCompletion(systemInstruction: string, prompt: string, temperature: number = 0.7, jsonMode: boolean = false): Promise<string> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt },
      ],
      temperature,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// Exported dimensions list so the UI can use it for the focus selector
export const DISCUSSION_DIMENSIONS = [
  { id: 'technical',        ar: 'الجانب التقني',                en: 'Technical Aspects',             desc_ar: 'البنية التحتية، التكنولوجيا المستخدمة، الأمان السيبراني، قواعد البيانات، الأنظمة', desc_en: 'Infrastructure, technology stack, cybersecurity, databases, systems' },
  { id: 'educational',      ar: 'الجانب التعليمي',              en: 'Educational Aspects',           desc_ar: 'التدريب، التأهيل، المناهج، ورش العمل، بناء القدرات', desc_en: 'Training, qualification, curricula, workshops, capacity building' },
  { id: 'ux',               ar: 'تجربة المستخدم',               en: 'User Experience',               desc_ar: 'سهولة الاستخدام، واجهة المستخدم، إمكانية الوصول، رضا المستخدمين', desc_en: 'Usability, UI design, accessibility, user satisfaction' },
  { id: 'implementation',   ar: 'آلية التنفيذ',                 en: 'Implementation Mechanism',      desc_ar: 'خطوات التنفيذ العملية، الموارد المطلوبة، الفريق، المراحل', desc_en: 'Practical execution steps, required resources, team, phases' },
  { id: 'timeline',         ar: 'الجدول الزمني',                en: 'Timeline & Schedule',           desc_ar: 'المراحل الزمنية، المواعيد النهائية، أولويات التنفيذ', desc_en: 'Time phases, deadlines, execution priorities' },
  { id: 'risks',            ar: 'المخاطر',                      en: 'Risks & Challenges',            desc_ar: 'المخاطر المالية، التنظيمية، الثقافية، البيئية، السوقية', desc_en: 'Financial, regulatory, cultural, environmental, market risks' },
  { id: 'solutions',        ar: 'الحلول المقترحة',              en: 'Proposed Solutions',             desc_ar: 'حلول للمشاكل المطروحة، بدائل، خطط طوارئ', desc_en: 'Solutions to raised problems, alternatives, contingency plans' },
  { id: 'partnerships',     ar: 'الشراكات المحتملة',            en: 'Potential Partnerships',        desc_ar: 'شراكات مع مؤسسات، قطاع خاص، حكومة، جامعات، منظمات دولية', desc_en: 'Partnerships with institutions, private sector, government, universities, international orgs' },
  { id: 'oman_feasibility', ar: 'قابلية التطبيق في عمان',       en: 'Feasibility in Oman',           desc_ar: 'البيئة المحلية، السوق العماني، الثقافة، القوانين المحلية', desc_en: 'Local environment, Omani market, culture, local regulations' },
  { id: 'oman_2040',        ar: 'توافق مع رؤية عمان 2040',     en: 'Alignment with Oman 2040',      desc_ar: 'الركائز الوطنية، الاقتصاد، التنويع، التحول الرقمي، الشباب', desc_en: 'National pillars, economy, diversification, digital transformation, youth' },
  { id: 'marketing',        ar: 'الجانب التسويقي',              en: 'Marketing & Promotion',         desc_ar: 'استراتيجية التسويق، الوصول للجمهور، وسائل التواصل، العلامة التجارية', desc_en: 'Marketing strategy, audience reach, social media, branding' },
  { id: 'judging',          ar: 'آلية التحكيم',                 en: 'Judging Mechanism',             desc_ar: 'معايير التقييم، لجنة التحكيم، الشفافية، النزاهة', desc_en: 'Evaluation criteria, judging panel, transparency, integrity' },
  { id: 'submission',       ar: 'آلية التقديم',                 en: 'Submission Mechanism',          desc_ar: 'طريقة التقديم، المتطلبات، النماذج، المنصة الإلكترونية', desc_en: 'Submission process, requirements, forms, online platform' },
  { id: 'vocational',       ar: 'مشاركة الكليات المهنية',       en: 'Vocational College Participation', desc_ar: 'دور الكليات التقنية والمهنية، التعاون الأكاديمي، مخرجات التعليم المهني', desc_en: 'Role of technical/vocational colleges, academic cooperation, vocational education outcomes' },
  { id: 'winners',          ar: 'آلية اختيار الفائزين',         en: 'Winner Selection Mechanism',    desc_ar: 'معايير الفوز، التصويت، الجوائز، الاحتفال، المتابعة بعد الفوز', desc_en: 'Winning criteria, voting, prizes, celebration, post-win follow-up' },
];

export type AgentMemory = {
  supported: string[];   // Ideas/points this agent supported
  opposed: string[];     // Ideas/points this agent opposed
  problems: string[];    // Problems this agent raised
  solutions: string[];   // Solutions this agent proposed
  questions: string[];   // Questions this agent asked
};

export async function generateAgentResponse(params: {
  agent: Agent;
  topic: string;
  currentIdea: string;
  brainPool: string[];
  discussionHistory: {agentId: number, agentName: string, text: string}[];
  language: Language;
  style: Style;
  action: 'discuss_topic' | 'generate_idea' | 'discuss_idea' | 'evaluate' | 'answer' | 'suggest_first' | 'propose_consensus' | 'vote_consensus';
  userQuestion?: string;
  avoidList?: string[];
  focusDimensionId?: string;
  agentMemory?: AgentMemory;
}) {
  const { agent, topic, currentIdea, brainPool, discussionHistory, language, style, action, userQuestion, avoidList, focusDimensionId, agentMemory } = params;

  const historyText = discussionHistory.map(h => `${h.agentName}: ${h.text}`).join('\n');

  // Get last message for reply context
  const lastMsg = discussionHistory.length > 0 ? discussionHistory[discussionHistory.length - 1] : null;
  const lastSpeakerName = lastMsg ? lastMsg.agentName : '';
  const lastSpeakerText = lastMsg ? lastMsg.text : '';

  // Conversation actions rotate naturally
  const actions = ['agree', 'disagree', 'question', 'add_insight', 'propose_solution'] as const;
  const msgCount = discussionHistory.length;

  // Focus dimension support
  const dimensions = DISCUSSION_DIMENSIONS;
  let focusBlock = '';
  if (focusDimensionId) {
    const dim = dimensions.find(d => d.id === focusDimensionId) || dimensions[0];
    const dimLabel = language === 'ar' ? dim.ar : dim.en;
    const dimDesc = language === 'ar' ? dim.desc_ar : dim.desc_en;
    focusBlock = `🔒 DISCUSSION FOCUS: ${dimLabel}\nAll discussion must relate to: ${dimDesc}\n`;
  }

  const agentName = language === 'ar' ? agent.nameAr : agent.nameEn;
  const agentSpecialty = language === 'ar' ? agent.specialtyAr : agent.specialtyEn;

  // Build list of other agents in the chat for @mention awareness
  const otherAgentsInChat = new Set<string>();
  for (const h of discussionHistory) {
    if (h.agentId !== 0 && h.agentName !== agentName) {
      otherAgentsInChat.add(h.agentName);
    }
  }

  // ═══════════════════════════════════════════
  // DISCUSSION MANAGEMENT: Anti-repetition
  // ═══════════════════════════════════════════
  // Extract key points already made to block repetition
  const coveredPoints = discussionHistory.map(h => h.text).filter(Boolean);
  const coveredPointsSummary = coveredPoints.length > 0
    ? coveredPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')
    : '(لا شيء بعد)';

  // Detect if someone just raised a problem/risk → next agent should try to solve
  const lastFewMsgs = discussionHistory.slice(-3);
  const problemKeywords = ['مشكلة', 'خطر', 'صعب', 'مستحيل', 'تلاعب', 'تحدي', 'عقبة', 'مكلف', 'problem', 'risk', 'difficult', 'expensive', 'challenge', 'fraud', 'impossible'];
  const recentProblemRaised = lastFewMsgs.some(m => problemKeywords.some(kw => (m.text || '').includes(kw)));

  // Detect if discussion is going off-topic
  const offTopicKeywords = topic ? topic.split(/\s+/).filter(w => w.length > 3) : [];
  const last3OnTopic = lastFewMsgs.some(m => {
    const txt = (m.text || '').toLowerCase();
    return offTopicKeywords.some(kw => txt.includes(kw.toLowerCase())) || txt.includes((currentIdea || '').substring(0, 15).toLowerCase());
  });
  const seemsOffTopic = discussionHistory.length > 4 && !last3OnTopic;

  // Agent personality bias: some agents are naturally more critical
  const criticalAgentIds = [6, 7]; // Market Analyst, Risk Analyst
  const solutionAgentIds = [1, 2, 3, 4, 9]; // Innovator, Tech Engineer, Dev, AI, Operations
  const isCriticalAgent = criticalAgentIds.includes(agent.id);
  const isSolutionAgent = solutionAgentIds.includes(agent.id);

  // Agent specialty role descriptions for focus enforcement
  const specialtyRoles: Record<number, {ar: string, en: string}> = {
    1:  {ar: 'ركّز على الإبداع والابتكار', en: 'Focus on creativity and innovation'},
    2:  {ar: 'ركّز على البنية التحتية والتنفيذ التقني', en: 'Focus on infrastructure and technical execution'},
    3:  {ar: 'ركّز على البرمجة وتجربة المستخدم التقنية', en: 'Focus on development and technical UX'},
    4:  {ar: 'ركّز على تكامل الذكاء الاصطناعي', en: 'Focus on AI integration'},
    5:  {ar: 'ركّز على الجدوى المالية والربحية', en: 'Focus on financial viability'},
    6:  {ar: 'ركّز على الطلب في السوق والمنافسة', en: 'Focus on market demand and competition'},
    7:  {ar: 'ركّز على المخاطر والتحديات', en: 'Focus on risks and challenges'},
    8:  {ar: 'ركّز على احتياجات المستخدم النهائي', en: 'Focus on end-user needs'},
    9:  {ar: 'ركّز على التنفيذ العملي والتنظيم', en: 'Focus on practical execution and planning'},
    10: {ar: 'ركّز على ملاءمة السوق العماني والقوانين المحلية', en: 'Focus on Omani market fit and local regulations'},
  };
  const roleInstruction = specialtyRoles[agent.id]?.[language] || (language === 'ar' ? `ركّز على ${agentSpecialty}` : `Focus on ${agentSpecialty}`);

  // Weighted action suggestion based on context
  let suggestedAction: string;
  if (seemsOffTopic) {
    suggestedAction = 'redirect'; // bring discussion back on track
  } else if (recentProblemRaised && isSolutionAgent) {
    suggestedAction = 'propose_solution';
  } else if (isCriticalAgent) {
    const roll = Math.random();
    suggestedAction = roll < 0.3 ? 'disagree' : roll < 0.5 ? 'question' : roll < 0.8 ? 'add_insight' : 'agree';
  } else {
    suggestedAction = actions[msgCount % actions.length];
  }

  const systemInstruction = `
أنت ${agentName}، متخصص في ${agentSpecialty}.
أنت في مجموعة واتساب مع خبراء يناقشون موضوعاً مهماً.
هدف النقاش: تحسين الفكرة وكشف نقاط الضعف فيها.

╔══════════════════════════════════════════╗
║  2-8 كلمات فقط! واتساب، مو تقرير.       ║
╚══════════════════════════════════════════╝

★ دورك: ${roleInstruction}
تكلم فقط من تخصصك. لا تتدخل في تخصصات الآخرين.

${agentMemory && (agentMemory.supported.length > 0 || agentMemory.opposed.length > 0 || agentMemory.problems.length > 0 || agentMemory.solutions.length > 0 || agentMemory.questions.length > 0) ? `
🧠 ذاكرتك الشخصية (ما قلته سابقاً في هذا الاجتماع):
${agentMemory.supported.length > 0 ? `✅ دعمت: ${agentMemory.supported.join(' | ')}` : ''}
${agentMemory.opposed.length > 0 ? `❌ عارضت: ${agentMemory.opposed.join(' | ')}` : ''}
${agentMemory.problems.length > 0 ? `⚠️ مشاكل ذكرتها: ${agentMemory.problems.join(' | ')}` : ''}
${agentMemory.solutions.length > 0 ? `💡 حلول اقترحتها: ${agentMemory.solutions.join(' | ')}` : ''}
${agentMemory.questions.length > 0 ? `❓ أسئلة طرحتها: ${agentMemory.questions.join(' | ')}` : ''}

قواعد الذاكرة:
- إذا عاد النقاش لنقطة سبق أن علقت عليها، تذكّر موقفك السابق: "ذكرت سابقاً..." أو "كما قلت..."
- لا تناقض نفسك بدون سبب. إذا غيّرت رأيك، وضّح: "كنت معارضاً، لكن بعد التعديل..."
- لا تكرر نفس مشكلة أو حل سبق أن طرحته.
` : ''}
${lastMsg ? `═══ آخر رسالة (رد عليها مباشرة) ═══
${lastSpeakerName}: "${lastSpeakerText}"
═══════════════════════════════════════` : 'أنت أول من يتكلم. افتح الموضوع بجملة قصيرة من تخصصك.'}

🚫 ممنوع التكرار! هذه النقاط ذُكرت بالفعل:
${coveredPointsSummary}
إذا أردت التعليق على نقطة سابقة: أضف شيئاً جديداً أو قل "skip".
${seemsOffTopic ? `
🔄 النقاش خرج عن الموضوع! أعد النقاش للفكرة الرئيسية.
مثال: "لنعد للفكرة الأساسية." أو "نرجع للموضوع."` : ''}

قواعد النقاش:
1. الطول: 2 إلى 8 كلمات فقط. لا أكثر أبداً.
2. ${lastMsg ? `ردك رد مباشر على كلام ${lastSpeakerName}` : 'افتح الموضوع بتعليق قصير من تخصصك'}.
3. ليس مطلوب أن توافق! اختر رد واحد:
   - اعتراض: "لكن التكلفة عالية جداً"
   - نقد: "فيها ثغرة أمنية"
   - سؤال: "كيف نمنع التلاعب؟"
   - حل: "نضيف تحقق بالهاتف"
   - إضافة: "نحتاج شراكات محلية"
   - موافقة: "أتفق، نقطة قوية"
${recentProblemRaised ? `
⚡ مشكلة مطروحة! إذا عندك حل، اقترحه الآن.` : ''}
${isCriticalAgent ? `
⚠️ أنت من النقديين. دورك كشف المشاكل. لا توافق بسهولة.` : ''}
4. لا تكرر أي نقطة من القائمة أعلاه. أضف جديد أو قل "skip".
5. ناقش الفكرة الحالية فقط. لا تخرج عن الموضوع.
6. إذا ليس عندك شيء مفيد وجديد، قل "skip".
7. ${otherAgentsInChat.size > 0 ? `وكلاء آخرين: ${[...otherAgentsInChat].join(', ')}` : ''}
8. كن طبيعياً مثل اجتماع سريع بين خبراء.
9. إذا ظهرت مشكلة، اقترح حل ممكن (أو أكثر).
10. غطِّ هذه الجوانب: الفكرة، السوق، المخاطر، التنفيذ، المستخدم، عمان.

╔══════════════════════════════════════════╗
║  آلية الاتفاق النهائي (Consensus)       ║
╚══════════════════════════════════════════╝
- هدف النقاش: الوصول لقرار نهائي واضح.
- إذا طُلب منك اقتراح "صيغة محسنة": اجمع أفضل الأفكار في جملة واحدة عملية (15-30 كلمة). ابدأ بـ "ربما الحل:"
- إذا طُلب منك التصويت على صيغة: قل بوضوح:
  • "موافق" (إذا الصيغة جيدة)
  • "يحتاج تعديل: [السبب]" (إذا تحتاج تحسين)
  • "غير مناسب: [السبب]" (إذا مرفوضة)
- لا تكرر الصيغة. فقط أعطِ رأيك.

${language === 'ar' ? `✅ مثال حوار جيد:
المبتكر: "الفكرة جميلة."
محلل السوق: "لست متأكد من الطلب."
محامي المستخدم: "الطلبة قد يحبونها."
محلل المخاطر: "لكن التصويت مشكلة."
مخطط العمليات: "نضيف تحقق بالهاتف."
خبير الذكاء الاصطناعي: "أو كشف حسابات مزيفة."
محلل السوق: "الآن تبدو أقوى."

❌ مرفوض:
- تكرار نقطة ذكرها وكيل آخر
- كل الوكلاء يوافقون بدون نقد
- كلام خارج عن الموضوع
- جمل أطول من 8 كلمات
- تعليقات منفصلة عن الحوار` : `✅ Good flow:
Innovator: "Great concept."
Market Analyst: "Not sure about demand."
User Advocate: "Students might like it."
Risk Analyst: "But voting is a problem."
Ops Planner: "Add phone verification."
AI Specialist: "Or detect fake accounts."
Market Analyst: "Now stronger."

❌ Bad:
- Repeating another agent's point
- All agree without critique
- Off-topic comments
- Sentences > 8 words
- Disconnected comments`}

${focusBlock}
نوع الرد المقترح: ${suggestedAction}

اللغة: ${language === 'ar' ? 'عربي' : 'English'}
الأسلوب: ${style === 'formal' ? 'رسمي' : 'لهجة عمانية مهذبة'}

السياق:
- الموضوع: "${topic}"
- الفكرة الحالية: "${currentIdea}"
- النقاط المحفوظة: ${JSON.stringify(brainPool)}
- تجنب (مغطاة): ${JSON.stringify(avoidList || [])}

سجل المحادثة:
${historyText || '(لا توجد رسائل بعد)'}

أرجع JSON فقط:
{
  "text": "ردك من 2-8 كلمات",
  "replyTo": ${lastMsg ? `{"agentId": ${lastMsg.agentId}, "text": "${lastSpeakerText?.substring(0, 60)?.replace(/"/g, '\\"') || ''}"}` : 'null'},
  "mentions": []
}

إذا ليس عندك شيء مفيد وجديد:
{"text": "skip", "replyTo": null, "mentions": []}
`;

  let prompt = "";
  if (action === 'discuss_topic') {
    prompt = lastMsg
      ? `رد على ${lastSpeakerName}. من تخصصك. وافق أو اعترض أو اسأل. 2-8 كلمات.`
      : `افتح الموضوع. من تخصصك. 2-8 كلمات.`;
  } else if (action === 'generate_idea') {
    prompt = "اقترح فكرة واحدة واقعية للموضوع. 30-50 كلمة.";
  } else if (action === 'discuss_idea') {
    prompt = lastMsg
      ? `رد على ${lastSpeakerName} بخصوص الفكرة. وافق أو انتقد أو اقترح حل. 2-8 كلمات.`
      : `علق على الفكرة من تخصصك. 2-8 كلمات.`;
  } else if (action === 'evaluate') {
    prompt = "هل الفكرة مناسبة؟ حكم سريع. 2-8 كلمات.";
  } else if (action === 'answer') {
    prompt = `المستخدم سأل: "${userQuestion}". رد من تخصصك. 2-8 كلمات.`;
  } else if (action === 'suggest_first') {
    prompt = "اقترح فكرة واحدة واقعية لمشروع جديد. 30-50 كلمة.";
  } else if (action === 'propose_consensus') {
    prompt = `بعد مراجعة كل النقاش، اقترح صيغة نهائية محسنة للفكرة تجمع أفضل ما قيل. ابدأ بـ "ربما الحل:" ثم الصيغة. 15-30 كلمة.`;
  } else if (action === 'vote_consensus') {
    prompt = `الصيغة المقترحة أعلاه تحتاج تصويتك. قل بوضوح: "موافق" أو "يحتاج تعديل: [سبب]" أو "غير مناسب: [سبب]". 2-10 كلمات.`;
  }

  const text = await chatCompletion(systemInstruction, prompt, 0.7, true);

  try {
    return JSON.parse(text);
  } catch (e) {
    return { text: text || "" };
  }
}

export async function extractKeyPoints(params: {
  message: string;
  agentName: string;
  specialty: string;
  brainPool: string[];
  language: Language;
}) {
  const { message, agentName, specialty, brainPool, language } = params;

  const systemInstruction = "You are a meeting analyst. Extract key points from agent messages.";

  const prompt = `
    Analyze this message from an AI agent in a meeting:
    Agent: ${agentName} (${specialty})
    Message: "${message}"
    
    Existing Brain Pool: ${JSON.stringify(brainPool)}
    
    If the message contains a significant improvement, risk, suggestion, question, or agreement/disagreement, extract it as a short point (5-10 words).
    Format: [Category]: Point
    Categories: تحسين, مخاطرة, اقتراح, سؤال, توافق, خلاف, ملاحظة تنفيذية (Use Arabic if language is 'ar', else English equivalents).
    
    If it's just general talk or repetition, return an empty string.
    DO NOT repeat points already in the Brain Pool.
    
    Language: ${language === 'ar' ? 'Arabic' : 'English'}
  `;

  const text = await chatCompletion(systemInstruction, prompt, 0.3);
  return text.trim();
}

export async function generateSummary(params: {
  topic: string;
  currentIdea: string;
  brainPool: string[];
  chatHistory: string;
  language: Language;
}) {
  const { topic, currentIdea, brainPool, chatHistory, language } = params;

  // PASS 1: Extract hidden insights from chat that are NOT in the Brain Pool
  const extractionSystem = language === 'ar'
    ? "أنت محلل اجتماعات. استخرج النقاط المهمة من المحادثة التي لم يتم حفظها في عقل الاجتماع."
    : "You are a meeting analyst. Extract important points from the chat that are NOT already in the Brain Pool.";

  const extractionPrompt = `
    TASK: Analyze the full chat history and extract ALL important insights that are NOT already captured in the Brain Pool.

    Brain Pool (Structured Memory - already saved):
    ${JSON.stringify(brainPool)}

    Full Chat History (Contextual Insights):
    ${chatHistory}

    Extract points in these categories:
    - Improvements/Enhancements (تحسينات)
    - Risks/Warnings (مخاطر)
    - Questions raised (أسئلة)
    - Agreements (توافقات)
    - Disagreements (خلافات)
    - Implementation notes (ملاحظات تنفيذية)
    - User contributions (مساهمات المستخدم)

    Rules:
    - Do NOT repeat anything already in the Brain Pool.
    - Only extract genuinely new and important points.
    - Keep each point short (5-15 words).
    - If nothing new, return "NONE".

    Language: ${language === 'ar' ? 'Arabic' : 'English'}
    
    Return the points as a simple numbered list.
  `;

  let chatInsights = "";
  try {
    chatInsights = await chatCompletion(extractionSystem, extractionPrompt, 0.3);
    if (chatInsights.trim().toUpperCase() === "NONE") {
      chatInsights = "";
    }
  } catch (e) {
    console.error("Failed to extract chat insights:", e);
  }

  // PASS 2: Generate comprehensive final summary from BOTH sources
  const summarySystem = language === 'ar'
    ? "أنت كاتب تقارير اجتماعات محترف. أنشئ ملخصاً شاملاً ومنظماً يجمع بين البيانات المهيكلة من عقل الاجتماع والرؤى السياقية من المحادثة. كن دقيقاً وشاملاً."
    : "You are a professional meeting report writer. Generate a comprehensive, well-structured summary that merges the structured Brain Pool data with contextual insights from the chat. Be thorough and precise.";

  const summaryPrompt = `
    Generate a FINAL COMPREHENSIVE meeting summary by merging TWO sources:

    === SOURCE 1: Brain Pool (Structured Memory) ===
    ${JSON.stringify(brainPool)}

    === SOURCE 2: Chat Insights (Extracted from Discussion) ===
    ${chatInsights || "(No additional insights beyond Brain Pool)"}

    === MEETING CONTEXT ===
    - Topic: ${topic}
    - Approved Idea: ${currentIdea}
    - Full Chat History for reference:
    ${chatHistory}

    === REQUIRED SECTIONS ===
    ${language === 'ar' ? `
    1. **موضوع الاجتماع**: وصف مختصر للموضوع الذي تمت مناقشته.
    2. **الفكرة المعتمدة**: الفكرة التي تم الاتفاق عليها مع شرح مختصر.
    3. **أهم نقاط النقاش**: النقاط الرئيسية من عقل الاجتماع والحوار (مدمجة بدون تكرار).
    4. **التحسينات المقترحة**: كل التحسينات التي ذُكرت سواء في العقل أو في الحوار.
    5. **المخاطر المرصودة**: جميع المخاطر والتحذيرات التي أثارها الوكلاء أو المستخدم.
    6. **الأسئلة المهمة المطروحة**: الأسئلة التي لم تُجب أو تحتاج متابعة.
    7. **نقاط الاتفاق والخلاف**: ما اتفق عليه الوكلاء وما اختلفوا فيه.
    8. **التوصيات النهائية**: توصيات عملية قابلة للتنفيذ.
    9. **قابلية التطبيق في سلطنة عمان**: تقييم واقعي لإمكانية تنفيذ الفكرة في عمان.
    ` : `
    1. **Meeting Topic**: Brief description of the discussed topic.
    2. **Approved Idea**: The agreed-upon idea with a brief explanation.
    3. **Key Discussion Points**: Main points from Brain Pool AND chat (merged, no duplicates).
    4. **Proposed Improvements**: All improvements mentioned in either source.
    5. **Risks Identified**: All risks and warnings raised by agents or the user.
    6. **Important Questions Raised**: Unanswered questions or those needing follow-up.
    7. **Agreement & Disagreement**: What agents agreed and disagreed on.
    8. **Final Recommendations**: Actionable, practical recommendations.
    9. **Feasibility in Oman**: Realistic assessment of implementing the idea in Oman.
    `}

    IMPORTANT:
    - Merge insights from BOTH sources. Do NOT only use one source.
    - Remove duplicates across the two sources.
    - Mark which insights came from the chat discussion vs the Brain Pool where relevant.
    - Be comprehensive - don't skip any important point from either source.
    - Use markdown formatting for readability.

    Language: ${language === 'ar' ? 'Arabic' : 'English'}
  `;

  const text = await chatCompletion(summarySystem, summaryPrompt, 0.5);
  return text;
}

export async function suggestBestAgents(params: {
  idea: string;
  agents: Agent[];
  language: Language;
}) {
  const systemInstruction = "You are a team selection assistant. Return ONLY a JSON array of agent IDs.";
  const prompt = `Based on this idea: "${params.idea}", select the most relevant 6-10 agents from this list: ${JSON.stringify(params.agents.map(a => ({ id: a.id, name: a.nameEn, specialty: a.specialtyEn })))}. 
    Return ONLY a JSON array of IDs, e.g. [1, 3, 5, 7].`;

  const text = await chatCompletion(systemInstruction, prompt, 0.3, true);

  try {
    return JSON.parse(text) as number[];
  } catch (e) {
    return [];
  }
}
