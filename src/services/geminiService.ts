import { GoogleGenAI, Type } from "@google/genai";
import { Agent, Language, Style } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateAgentResponse(params: {
  agent: Agent;
  topic: string;
  currentIdea: string;
  brainPool: string[];
  discussionHistory: {agentId: number, agentName: string, text: string}[];
  language: Language;
  style: Style;
  action: 'discuss_topic' | 'generate_idea' | 'discuss_idea' | 'evaluate' | 'answer' | 'suggest_first';
  userQuestion?: string;
  avoidList?: string[];
}) {
  const { agent, topic, currentIdea, brainPool, discussionHistory, language, style, action, userQuestion, avoidList } = params;

  const historyText = discussionHistory.map(h => `${h.agentName}: ${h.text}`).join('\n');

  const systemInstruction = `
    You are ${language === 'ar' ? agent.nameAr : agent.nameEn}, a specialist in ${language === 'ar' ? agent.specialtyAr : agent.specialtyEn}.
    Your goal is to participate in a "Majlis" (council) to develop ideas.
    
    CONSTRAINTS:
    - Language: ${language === 'ar' ? 'Arabic' : 'English'}.
    - Style: ${style === 'formal' ? 'Formal' : 'Omani Dialect (polite and professional)'}.
    - Length: STRICTLY UNDER 10 WORDS for discussions.
    - Focus: Be realistic and applicable, especially in the context of Oman if relevant to your specialty.
    - No repetition: Do not repeat what has been said in the brain pool or previous discussions.
    - Interaction: This is a CHAT conversation (like WhatsApp). You can reply to a specific message or mention an agent.
    - Tone: Professional, constructive, and insightful.
    - NO NEW IDEAS: Do not suggest new ideas unless explicitly asked in the prompt.

    RESPONSE FORMAT:
    You MUST return your response as a JSON object with these fields:
    - "text": The message content (strictly under 10 words for discussions).
    - "replyTo": (Optional) An object { "agentId": number, "text": string } if you are replying to a specific agent in the history.
    - "mentions": (Optional) An array of agent names (English or Arabic as per current language) you want to mention.

    CONTEXT:
    - Meeting Topic: "${topic}"
    - Current Idea being discussed: "${currentIdea}"
    - Approved ideas in Brain Pool: ${JSON.stringify(brainPool)}
    - Discussion History:
    ${historyText}
    - Avoid these points (Memory): ${JSON.stringify(avoidList || [])}
  `;

  let prompt = "";
  if (action === 'discuss_topic') {
    prompt = "Discuss the meeting topic only. DO NOT suggest any ideas yet. Share a quick observation or response to the last message in the chat. You can reply to someone or mention someone.";
  } else if (action === 'generate_idea') {
    prompt = "Generate exactly ONE realistic idea related to the topic. This is the only time you can suggest a new idea. Keep it concise (30-50 words).";
  } else if (action === 'discuss_idea') {
    prompt = "Discuss the current idea only. DO NOT suggest new ideas. Respond to the last message or add a small detail. You can reply to someone or mention someone.";
  } else if (action === 'evaluate') {
    prompt = "Evaluate if the current idea is suitable or not. Give a quick judgment and a brief reason.";
  } else if (action === 'answer') {
    prompt = `The user asked you: "${userQuestion}". Answer directly.`;
  } else if (action === 'suggest_first') {
    prompt = "Suggest a single, realistic first idea for a new project or business in 30-50 words.";
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.7,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          replyTo: {
            type: Type.OBJECT,
            properties: {
              agentId: { type: Type.INTEGER },
              text: { type: Type.STRING }
            }
          },
          mentions: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        },
        required: ["text"]
      }
    },
  });

  try {
    return JSON.parse(response.text || '{"text": ""}');
  } catch (e) {
    return { text: response.text || "" };
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.3,
    },
  });

  return response.text?.trim() || "";
}

export async function generateSummary(params: {
  topic: string;
  currentIdea: string;
  brainPool: string[];
  chatHistory: string;
  language: Language;
}) {
  const { topic, currentIdea, brainPool, chatHistory, language } = params;

  const prompt = `
    Generate a final comprehensive summary for the meeting:
    - Topic: ${topic}
    - Approved Idea: ${currentIdea}
    - Structured Brain Pool Points: ${JSON.stringify(brainPool)}
    - Full Chat History Context: ${chatHistory}
    
    Structure the summary into these sections:
    1. Meeting Topic (العنوان)
    2. Approved Idea (الفكرة المعتمدة)
    3. Key Discussion Points (أهم نقاط النقاش من عقل الاجتماع والحوار)
    4. Risks Identified (المخاطر المرصودة)
    5. Proposed Improvements (التحسينات المقترحة)
    6. Important Questions Raised (الأسئلة المهمة المطروحة)
    7. Agreement & Disagreement (نقاط الاتفاق والخلاف)
    8. Final Recommendations (التوصيات النهائية)
    9. Feasibility in Oman (قابلية التطبيق في سلطنة عمان)
    
    Language: ${language === 'ar' ? 'Arabic' : 'English'}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      temperature: 0.5,
    },
  });

  return response.text || "";
}

export async function suggestBestAgents(params: {
  idea: string;
  agents: Agent[];
  language: Language;
}) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this idea: "${params.idea}", select the most relevant 6-10 agents from this list: ${JSON.stringify(params.agents.map(a => ({ id: a.id, name: a.nameEn, specialty: a.specialtyEn })))}. 
    Return ONLY a JSON array of IDs.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER }
      }
    }
  });

  try {
    return JSON.parse(response.text || "[]") as number[];
  } catch (e) {
    return [];
  }
}
