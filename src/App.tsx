import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Lightbulb, Settings, Code, Cpu, BarChart3, UserCheck, TrendingUp, 
  ShieldAlert, ClipboardList, Maximize, MapPin, Gavel, Building2, 
  Users, Wallet, Handshake, CloudSun, Truck, Factory, Target,
  Plus, Send, Play, Square, RefreshCw, X, ChevronRight, ChevronLeft,
  MessageSquare, Brain, Info, CheckCircle2, AlertCircle, Download, Copy,
  Star, Globe, Languages, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { cn } from './lib/utils';
import { AGENTS, TRANSLATIONS, Agent, Language, Style, Mode } from './constants';
import { generateAgentResponse, generateSummary, suggestBestAgents, extractKeyPoints, DISCUSSION_DIMENSIONS, AgentMemory } from './services/geminiService';

const ICON_MAP: Record<string, any> = {
  Lightbulb, Settings, Code, Cpu, BarChart3, UserCheck, TrendingUp, 
  ShieldAlert, ClipboardList, Maximize, MapPin, Gavel, Building2, 
  Users, Wallet, Handshake, CloudSun, Truck, Factory, Target
};

export default function App() {
  // Session State
  const [isStarted, setIsStarted] = useState(false);
  const [language, setLanguage] = useState<Language>('ar');
  const [style, setStyle] = useState<Style>('formal');
  const [mode, setMode] = useState<Mode>('manual');
  const [participantScope, setParticipantScope] = useState<'all' | 'selected'>('all');
  const [selectedAgentIds, setSelectedAgentIds] = useState<number[]>(AGENTS.map(a => a.id));
  
  // App State
  const [phase, setPhase] = useState<'topic_discussion' | 'idea_generation' | 'idea_discussion'>('topic_discussion');
  const [topic, setTopic] = useState("");
  const [brainPool, setBrainPool] = useState<string[]>([]);
  const [currentIdea, setCurrentIdea] = useState<string>("");
  const [discussions, setDiscussions] = useState<{
    agentId: number, 
    text: string, 
    timestamp: number,
    replyTo?: { agentId: number, text: string },
    mentions?: string[],
    isSystem?: boolean
  }[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [topicInput, setTopicInput] = useState("");
  const [generatedIdea, setGeneratedIdea] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [selectedAgentProfile, setSelectedAgentProfile] = useState<Agent | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [avoidList, setAvoidList] = useState<string[]>([]);
  const [focusDimensionId, setFocusDimensionId] = useState<string | null>(null);
  const [showFocusSelector, setShowFocusSelector] = useState(false);
  const [agentRatings, setAgentRatings] = useState<Record<number, {relevance: number, quality: number, comment: string}>>({});
  const [userMessage, setUserMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<{ agentId: number, text: string } | null>(null);
  const [discussionStatus, setDiscussionStatus] = useState<'discussing' | 'agreed' | 'weak'>('discussing');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const userInputRef = useRef<HTMLInputElement>(null);
  const brainPoolRef = useRef<HTMLDivElement>(null);

  // Chain discussion refs
  const chainActiveRef = useRef(false);
  const discussionsRef = useRef<typeof discussions>([]);
  const brainPoolStateRef = useRef<string[]>([]);

  // Agent Personal Memory - persists for the entire meeting session
  const [agentMemories, setAgentMemories] = useState<Record<number, AgentMemory>>({});
  const agentMemoriesRef = useRef<Record<number, AgentMemory>>({});

  const t = TRANSLATIONS[language];
  const isRTL = language === 'ar';

  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with state
  useEffect(() => { discussionsRef.current = discussions; }, [discussions]);
  useEffect(() => { brainPoolStateRef.current = brainPool; }, [brainPool]);
  useEffect(() => { agentMemoriesRef.current = agentMemories; }, [agentMemories]);

  // Helper: classify agent response and update memory
  const classifyAndUpdateMemory = (agentId: number, text: string) => {
    if (!text || agentId === 0) return;
    const t = text.toLowerCase();
    const mem = agentMemoriesRef.current[agentId] || { supported: [], opposed: [], problems: [], solutions: [], questions: [] };
    const short = text.length > 80 ? text.substring(0, 80) + '...' : text;

    // Classify based on keywords
    const isQuestion = t.includes('?') || t.includes('؟') || t.includes('كيف') || t.includes('لماذا') || t.includes('هل ');
    const isOpposition = t.includes('لكن') || t.includes('مشكل') || t.includes('خطر') || t.includes('صعب') || t.includes('غير مناسب') || t.includes('ثغر') || t.includes('مكلف') || t.includes('but') || t.includes('risk') || t.includes('problem') || t.includes('معارض');
    const isSolution = t.includes('نضيف') || t.includes('حل') || t.includes('اقترح') || t.includes('بديل') || t.includes('نستخدم') || t.includes('add') || t.includes('solution') || t.includes('use') || t.includes('ربما الحل');
    const isSupport = t.includes('أتفق') || t.includes('موافق') || t.includes('نقطة قوية') || t.includes('صحيح') || t.includes('جيد') || t.includes('جميل') || t.includes('agree') || t.includes('great') || t.includes('good');
    const isProblem = t.includes('مشكلة') || t.includes('خطر') || t.includes('تحدي') || t.includes('عقبة') || t.includes('تلاعب') || t.includes('problem') || t.includes('risk') || t.includes('challenge') || t.includes('fraud');

    const MAX_ITEMS = 5; // Keep memory concise

    if (isQuestion && mem.questions.length < MAX_ITEMS) {
      mem.questions.push(short);
    } else if (isSolution && mem.solutions.length < MAX_ITEMS) {
      mem.solutions.push(short);
    } else if (isProblem && mem.problems.length < MAX_ITEMS) {
      mem.problems.push(short);
    } else if (isOpposition && mem.opposed.length < MAX_ITEMS) {
      mem.opposed.push(short);
    } else if (isSupport && mem.supported.length < MAX_ITEMS) {
      mem.supported.push(short);
    }

    const updated = { ...agentMemoriesRef.current, [agentId]: mem };
    setAgentMemories(updated);
    agentMemoriesRef.current = updated;
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions, isThinking]);

  // Auto-scroll Brain Pool when new points are added
  useEffect(() => {
    if (brainPoolRef.current) {
      brainPoolRef.current.scrollTop = brainPoolRef.current.scrollHeight;
    }
  }, [brainPool]);

  // @Mention autocomplete: detect @ in user message
  const handleUserMessageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUserMessage(val);

    // Find the last @ in the string
    const lastAtIndex = val.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const afterAt = val.slice(lastAtIndex + 1);
      // If there's a space after the potential mention, close the list
      if (afterAt.includes(' ') && afterAt.trim().length > 0) {
        setShowMentionList(false);
      } else {
        setMentionFilter(afterAt.toLowerCase());
        setShowMentionList(true);
      }
    } else {
      setShowMentionList(false);
    }
  };

  const handleSelectMention = (agent: Agent) => {
    const lastAtIndex = userMessage.lastIndexOf('@');
    const name = language === 'ar' ? agent.nameAr : agent.nameEn;
    const newMsg = userMessage.slice(0, lastAtIndex) + `@${name} `;
    setUserMessage(newMsg);
    setShowMentionList(false);
    userInputRef.current?.focus();
  };

  const filteredMentionAgents = useMemo(() => {
    const activeAgents = AGENTS.filter(a => selectedAgentIds.includes(a.id));
    if (!mentionFilter) return activeAgents;
    return activeAgents.filter(a =>
      a.nameAr.toLowerCase().includes(mentionFilter) ||
      a.nameEn.toLowerCase().includes(mentionFilter)
    );
  }, [mentionFilter, selectedAgentIds]);

  // Auto Mode Logic - uses chain-based approach
  useEffect(() => {
    let timer: any;
    if (isAutoPlaying && (topic || currentIdea) && !isThinking && !chainActiveRef.current) {
      timer = setTimeout(() => {
        if (!chainActiveRef.current && !isThinking) {
          runDiscussionChain(5);
        }
      }, 1500);
    }
    return () => clearTimeout(timer);
  }, [isAutoPlaying, topic, currentIdea, isThinking]);

  // Auto-start discussion chain when topic is first set
  const hasStartedFirstChainRef = useRef(false);
  useEffect(() => {
    if (topic && discussions.length === 0 && !hasStartedFirstChainRef.current && !chainActiveRef.current) {
      hasStartedFirstChainRef.current = true;
      runDiscussionChain(6);
    }
  }, [topic, discussions.length]);

  const handleStartMeeting = () => {
    setIsStarted(true);
  };

  const handleSetTopic = () => {
    if (!topicInput.trim()) return;
    setTopic(topicInput);
    setPhase('topic_discussion');
    setDiscussionStatus('discussing');
    // Reset agent memories for new topic
    setAgentMemories({});
    agentMemoriesRef.current = {};
  };

  const handleSuggestFirstIdea = async () => {
    setIsThinking(true);
    try {
      const suggestion = await generateAgentResponse({
        agent: AGENTS[0], // Innovator
        topic: "",
        currentIdea: "",
        brainPool: [],
        discussionHistory: [],
        language,
        style,
        action: 'suggest_first'
      });
      setTopicInput(suggestion.text);
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  const handleGenerateIdea = async () => {
    if (!topic || isThinking || isMeetingEnded) return;
    setIsThinking(true);
    const agent = AGENTS[0]; // Innovator usually generates
    try {
      const response = await generateAgentResponse({
        agent,
        topic,
        currentIdea: "",
        brainPool,
        discussionHistory: [],
        language,
        style,
        action: 'generate_idea'
      });
      setGeneratedIdea(response.text);
      setPhase('idea_generation');
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  const handleAddToBrainPool = async (idea: string) => {
    if (!idea.trim()) return;
    if (brainPool.includes(idea)) {
      alert(t.duplicateWarning);
      return;
    }
    const newPool = [...brainPool, idea];
    setBrainPool(newPool);
    setCurrentIdea(idea);
    setGeneratedIdea("");
    setPhase('idea_discussion');

    // Suggest best agents for this idea
    if (participantScope === 'selected') {
      const bestIds = await suggestBestAgents({ idea, agents: AGENTS, language });
      setSelectedAgentIds(bestIds);
    }
  };

  // Run a chain of N agent-to-agent discussion rounds with Consensus Algorithm
  const runDiscussionChain = async (rounds: number, startDiscussions?: typeof discussions, startBrainPool?: string[]) => {
    if (chainActiveRef.current || isMeetingEnded) return;
    chainActiveRef.current = true;
    setIsThinking(true);

    const activeAgents = AGENTS.filter(a => selectedAgentIds.includes(a.id));
    let localDiscussions = startDiscussions ? [...startDiscussions] : [...discussionsRef.current];
    let localBrainPool = startBrainPool ? [...startBrainPool] : [...brainPoolStateRef.current];

    // Track how many times each agent has spoken for fair distribution
    const agentMsgCounts: Record<number, number> = {};
    for (const d of localDiscussions) {
      if (d.agentId !== 0) {
        agentMsgCounts[d.agentId] = (agentMsgCounts[d.agentId] || 0) + 1;
      }
    }

    // ═══ Consensus Algorithm State ═══
    const DISCUSSION_ROUNDS = Math.min(rounds, 6);
    let consensusPhase: 'discussion' | 'proposal' | 'voting' | 'resolved' = 'discussion';
    let consensusProposal = '';
    let proposerAgentId = -1;
    const votes: Record<number, 'agree' | 'modify' | 'reject'> = {};
    const totalRounds = rounds + activeAgents.length + 2;

    // Reset status to discussing at the start of each chain
    setDiscussionStatus('discussing');

    for (let round = 0; round < totalRounds; round++) {
      if (!chainActiveRef.current || isMeetingEnded) break;
      if (consensusPhase === 'resolved') break;

      // Transition to proposal phase after enough free discussion
      if (consensusPhase === 'discussion' && round >= DISCUSSION_ROUNDS) {
        consensusPhase = 'proposal';
      }

      // ── Agent Selection ──
      const lastSpeakerId = localDiscussions.length > 0 ? localDiscussions[localDiscussions.length - 1].agentId : -1;
      const secondLastId = localDiscussions.length > 1 ? localDiscussions[localDiscussions.length - 2].agentId : -1;
      let agent: (typeof activeAgents)[0];

      if (consensusPhase === 'voting') {
        // Voting: pick agents who haven't voted yet
        const unvotedAgents = activeAgents.filter(a =>
          a.id !== proposerAgentId && !votes[a.id] && a.id !== lastSpeakerId
        );
        if (unvotedAgents.length === 0) {
          // All voted → check consensus
          const agreeCount = Object.values(votes).filter(v => v === 'agree').length;
          const totalVotes = Object.keys(votes).length;

          setIsThinking(false);
          await new Promise(r => setTimeout(r, 800));
          setIsThinking(true);

          if (agreeCount > totalVotes / 2) {
            consensusPhase = 'resolved';
            setDiscussionStatus('agreed');
            const consensusMsg = {
              agentId: 0,
              text: language === 'ar'
                ? `✅ تم الاتفاق على الفكرة (${agreeCount}/${totalVotes} موافق):\n"${consensusProposal}"`
                : `✅ Consensus reached (${agreeCount}/${totalVotes} agreed):\n"${consensusProposal}"`,
              timestamp: Date.now(),
              isSystem: true
            };
            localDiscussions.push(consensusMsg);
            setDiscussions([...localDiscussions]);
            discussionsRef.current = [...localDiscussions];
            // Save ONLY consensus to brain pool
            const consensusPoint = language === 'ar'
              ? `[اتفاق]: ${consensusProposal}`
              : `[Consensus]: ${consensusProposal}`;
            if (!localBrainPool.includes(consensusPoint)) {
              localBrainPool.push(consensusPoint);
              setBrainPool([...localBrainPool]);
              brainPoolStateRef.current = [...localBrainPool];
            }
          } else {
            setDiscussionStatus('weak');
            const noConsensusMsg = {
              agentId: 0,
              text: language === 'ar'
                ? `⚠️ لم يتم الاتفاق (${agreeCount}/${totalVotes} موافق). يحتاج مزيد من النقاش.`
                : `⚠️ No consensus (${agreeCount}/${totalVotes} agreed). More discussion needed.`,
              timestamp: Date.now(),
              isSystem: true
            };
            localDiscussions.push(noConsensusMsg);
            setDiscussions([...localDiscussions]);
            discussionsRef.current = [...localDiscussions];
          }
          break;
        }
        agent = unvotedAgents[Math.floor(Math.random() * unvotedAgents.length)];
      } else {
        // Discussion & Proposal: fair distribution, no consecutive speakers
        let available = activeAgents.filter(a => a.id !== lastSpeakerId && a.id !== secondLastId);
        if (available.length === 0) available = activeAgents.filter(a => a.id !== lastSpeakerId);
        if (available.length === 0) available = activeAgents;

        available.sort((a, b) => (agentMsgCounts[a.id] || 0) - (agentMsgCounts[b.id] || 0));
        const minCount = agentMsgCounts[available[0].id] || 0;
        const leastSpoken = available.filter(a => (agentMsgCounts[a.id] || 0) <= minCount + 1);
        agent = leastSpoken[Math.floor(Math.random() * leastSpoken.length)];
      }

      // ── Build History ──
      const history = localDiscussions.slice(-12).map(d => ({
        agentId: d.agentId,
        agentName: d.agentId === 0
          ? (language === 'ar' ? 'المستخدم' : 'User')
          : (language === 'ar'
            ? (AGENTS.find(a => a.id === d.agentId)?.nameAr || '')
            : (AGENTS.find(a => a.id === d.agentId)?.nameEn || '')),
        text: d.text
      }));

      // ── Determine Action ──
      let chainAction: string;
      if (consensusPhase === 'proposal') {
        chainAction = 'propose_consensus';
      } else if (consensusPhase === 'voting') {
        chainAction = 'vote_consensus';
      } else {
        chainAction = phase === 'topic_discussion' ? 'discuss_topic' : 'discuss_idea';
      }

      try {
        const response = await generateAgentResponse({
          agent,
          topic,
          currentIdea: consensusPhase === 'voting' ? consensusProposal : currentIdea,
          brainPool: localBrainPool,
          discussionHistory: history,
          language,
          style,
          action: chainAction as any,
          avoidList,
          focusDimensionId: focusDimensionId || undefined,
          agentMemory: agentMemoriesRef.current[agent.id]
        });

        if (!chainActiveRef.current) break;

        // Skip handling
        const responseText = (response.text || '').trim().toLowerCase();
        if (responseText === 'skip' || responseText === '"skip"' || responseText === '' || responseText === 'skip.') {
          if (round < totalRounds - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          continue;
        }

        const lastMsg = localDiscussions.length > 0 ? localDiscussions[localDiscussions.length - 1] : null;
        const newMsg = {
          agentId: agent.id,
          text: response.text,
          timestamp: Date.now(),
          replyTo: lastMsg ? { agentId: lastMsg.agentId, text: lastMsg.text } : response.replyTo,
          mentions: response.mentions
        };

        localDiscussions.push(newMsg);
        setDiscussions([...localDiscussions]);
        discussionsRef.current = [...localDiscussions];
        agentMsgCounts[agent.id] = (agentMsgCounts[agent.id] || 0) + 1;

        // Update agent personal memory
        classifyAndUpdateMemory(agent.id, response.text);

        // ── Handle Consensus Phase Transitions ──
        if (consensusPhase === 'proposal') {
          consensusProposal = response.text;
          proposerAgentId = agent.id;
          consensusPhase = 'voting';
        } else if (consensusPhase === 'voting') {
          // Parse vote from response
          const voteText = (response.text || '').toLowerCase();
          if (voteText.includes('موافق') || voteText.includes('أتفق') || voteText.includes('agree') || voteText.includes('نعم')) {
            votes[agent.id] = 'agree';
          } else if (voteText.includes('تعديل') || voteText.includes('modify') || voteText.includes('لكن')) {
            votes[agent.id] = 'modify';
          } else {
            votes[agent.id] = 'reject';
          }

          // Check if enough votes to decide early
          const totalVotes = Object.keys(votes).length;
          const remaining = activeAgents.filter(a => a.id !== proposerAgentId && !votes[a.id]).length;
          if (remaining === 0 || totalVotes >= Math.ceil((activeAgents.length - 1) * 0.8)) {
            const agreeCount = Object.values(votes).filter(v => v === 'agree').length;
            setIsThinking(false);
            await new Promise(r => setTimeout(r, 800));
            setIsThinking(true);
            if (agreeCount > totalVotes / 2) {
              consensusPhase = 'resolved';
              setDiscussionStatus('agreed');
              const consensusMsg = {
                agentId: 0,
                text: language === 'ar'
                  ? `✅ تم الاتفاق على الفكرة (${agreeCount}/${totalVotes} موافق):\n"${consensusProposal}"`
                  : `✅ Consensus reached (${agreeCount}/${totalVotes} agreed):\n"${consensusProposal}"`,
                timestamp: Date.now(),
                isSystem: true
              };
              localDiscussions.push(consensusMsg);
              setDiscussions([...localDiscussions]);
              discussionsRef.current = [...localDiscussions];
              const consensusPoint = language === 'ar'
                ? `[اتفاق]: ${consensusProposal}`
                : `[Consensus]: ${consensusProposal}`;
              if (!localBrainPool.includes(consensusPoint)) {
                localBrainPool.push(consensusPoint);
                setBrainPool([...localBrainPool]);
                brainPoolStateRef.current = [...localBrainPool];
              }
              break;
            } else if (remaining === 0) {
              setDiscussionStatus('weak');
              const noConsensusMsg = {
                agentId: 0,
                text: language === 'ar'
                  ? `⚠️ لم يتم الاتفاق (${agreeCount}/${totalVotes} موافق). يحتاج مزيد من النقاش.`
                  : `⚠️ No consensus (${agreeCount}/${totalVotes} agreed). More discussion needed.`,
                timestamp: Date.now(),
                isSystem: true
              };
              localDiscussions.push(noConsensusMsg);
              setDiscussions([...localDiscussions]);
              discussionsRef.current = [...localDiscussions];
              break;
            }
          }
        }

        // Delay between messages for natural chat feel
        if (round < totalRounds - 1 && consensusPhase !== 'resolved') {
          setIsThinking(false);
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!chainActiveRef.current) break;
          setIsThinking(true);
        }
      } catch (e) {
        console.error('Chain round error:', e);
        break;
      }
    }

    chainActiveRef.current = false;
    setIsThinking(false);
  };

  const handleContinueDiscussion = async () => {
    if (chainActiveRef.current || isThinking || isMeetingEnded) return;
    if (phase === 'topic_discussion' && !topic) return;
    if (phase === 'idea_discussion' && !currentIdea) return;
    if (phase === 'idea_generation') return;

    runDiscussionChain(5);
  };

  const handleAskAgent = async (agent: Agent, question: string) => {
    if (!question.trim() || isThinking || isMeetingEnded) return;
    setIsThinking(true);
    const history = discussions.slice(-5).map(d => ({
      agentId: d.agentId,
      agentName: d.agentId === 0 
        ? (language === 'ar' ? 'المستخدم' : 'User')
        : (language === 'ar' ? AGENTS.find(a => a.id === d.agentId)!.nameAr : AGENTS.find(a => a.id === d.agentId)!.nameEn),
      text: d.text
    }));
    try {
      const response = await generateAgentResponse({
        agent,
        topic,
        currentIdea,
        brainPool,
        discussionHistory: history,
        language,
        style,
        action: 'answer',
        userQuestion: question,
        focusDimensionId: focusDimensionId || undefined,
        agentMemory: agentMemoriesRef.current[agent.id]
      });
      
      const newMsg = {
        agentId: agent.id,
        text: response.text,
        timestamp: Date.now(),
        replyTo: response.replyTo,
        mentions: response.mentions
      };
      
      setDiscussions(prev => [...prev, newMsg]);

      // Update agent personal memory
      classifyAndUpdateMemory(agent.id, response.text);

      // Automatic Brain Update
      const keyPoint = await extractKeyPoints({
        message: response.text,
        agentName: language === 'ar' ? agent.nameAr : agent.nameEn,
        specialty: language === 'ar' ? agent.specialtyAr : agent.specialtyEn,
        brainPool,
        language
      });

      if (keyPoint && !brainPool.includes(keyPoint)) {
        setBrainPool(prev => [...prev, keyPoint]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  const handleEvaluateIdea = async (agent: Agent) => {
    if (!currentIdea || isThinking || isMeetingEnded) return;
    setIsThinking(true);
    const history = discussions.slice(-5).map(d => ({
      agentId: d.agentId,
      agentName: d.agentId === 0 
        ? (language === 'ar' ? 'المستخدم' : 'User')
        : (language === 'ar' ? AGENTS.find(a => a.id === d.agentId)!.nameAr : AGENTS.find(a => a.id === d.agentId)!.nameEn),
      text: d.text
    }));
    try {
      const response = await generateAgentResponse({
        agent,
        topic,
        currentIdea,
        brainPool,
        discussionHistory: history,
        language,
        style,
        action: 'evaluate',
        focusDimensionId: focusDimensionId || undefined,
        agentMemory: agentMemoriesRef.current[agent.id]
      });

      const newMsg = {
        agentId: agent.id,
        text: response.text,
        timestamp: Date.now(),
        replyTo: response.replyTo,
        mentions: response.mentions
      };

      setDiscussions(prev => [...prev, newMsg]);

      // Update agent personal memory
      classifyAndUpdateMemory(agent.id, response.text);

      // Automatic Brain Update
      const keyPoint = await extractKeyPoints({
        message: response.text,
        agentName: language === 'ar' ? agent.nameAr : agent.nameEn,
        specialty: language === 'ar' ? agent.specialtyAr : agent.specialtyEn,
        brainPool,
        language
      });

      if (keyPoint && !brainPool.includes(keyPoint)) {
        setBrainPool(prev => [...prev, keyPoint]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  // Detect @mention in user message and find the matching agent
  const findMentionedAgent = (text: string): Agent | null => {
    const activeAgents = AGENTS.filter(a => selectedAgentIds.includes(a.id));
    for (const agent of activeAgents) {
      if (text.includes(`@${agent.nameEn}`) || text.includes(`@${agent.nameAr}`)) {
        return agent;
      }
    }
    return null;
  };

  const handleUserSendMessage = async () => {
    if (!userMessage.trim() || isMeetingEnded) return;

    // Stop any running chain first
    chainActiveRef.current = false;
    await new Promise(r => setTimeout(r, 150));

    const msgText = userMessage.trim();
    setUserMessage("");
    const currentReplyTo = replyingTo;
    setReplyingTo(null);

    // Add user message to discussion (agentId 0 = user)
    const userMsg = {
      agentId: 0,
      text: msgText,
      timestamp: Date.now(),
      replyTo: currentReplyTo || undefined,
    };

    const updatedDiscussions = [...discussionsRef.current, userMsg];
    setDiscussions(updatedDiscussions);
    discussionsRef.current = updatedDiscussions;

    // Start a discussion chain — agents will respond to user then discuss among themselves
    runDiscussionChain(6, updatedDiscussions, [...brainPoolStateRef.current]);
  };

  const handleEndMeeting = async () => {
    setIsAutoPlaying(false);
    chainActiveRef.current = false;
    setIsMeetingEnded(true);
    setIsThinking(true);
    
    const chatHistory = discussions.map(d => {
      if (d.agentId === 0) {
        return `${language === 'ar' ? 'المستخدم' : 'User'}: ${d.text}`;
      }
      const agent = AGENTS.find(a => a.id === d.agentId)!;
      return `${language === 'ar' ? agent.nameAr : agent.nameEn}: ${d.text}`;
    }).join('\n');

    try {
      const summary = await generateSummary({
        topic,
        currentIdea,
        brainPool,
        chatHistory,
        language
      });
      setSummaryContent(summary);
      setShowSummary(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsThinking(false);
    }
  };

  const handleExport = (type: 'pdf' | 'txt' | 'copy') => {
    if (type === 'copy') {
      navigator.clipboard.writeText(summaryContent);
      alert(language === 'ar' ? "تم النسخ بنجاح" : "Copied successfully");
    } else if (type === 'txt') {
      const blob = new Blob([summaryContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Majlis_Summary_${Date.now()}.txt`;
      a.click();
    } else if (type === 'pdf') {
      window.print();
    }
  };

  if (!isStarted) {
    return (
      <div className={cn("min-h-screen bg-slate-900 text-white flex items-center justify-center p-4 font-sans", isRTL ? "rtl" : "ltr")}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-800 rounded-3xl p-8 shadow-2xl border border-slate-700"
        >
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Brain className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            {t.title}
          </h1>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Languages className="w-4 h-4" /> {t.language}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setLanguage('ar')}
                  className={cn("py-2 rounded-xl transition-all", language === 'ar' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  العربية
                </button>
                <button 
                  onClick={() => setLanguage('en')}
                  className={cn("py-2 rounded-xl transition-all", language === 'en' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  English
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> {t.style}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setStyle('formal')}
                  className={cn("py-2 rounded-xl transition-all", style === 'formal' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.formal}
                </button>
                <button 
                  onClick={() => setStyle('omani')}
                  className={cn("py-2 rounded-xl transition-all", style === 'omani' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.omani}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> {t.mode}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setMode('manual')}
                  className={cn("py-2 rounded-xl transition-all", mode === 'manual' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.manual}
                </button>
                <button 
                  onClick={() => setMode('auto')}
                  className={cn("py-2 rounded-xl transition-all", mode === 'auto' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.auto}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2 flex items-center gap-2">
                <Users className="w-4 h-4" /> {t.participants}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setParticipantScope('all')}
                  className={cn("py-2 rounded-xl transition-all", participantScope === 'all' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.all}
                </button>
                <button 
                  onClick={() => setParticipantScope('selected')}
                  className={cn("py-2 rounded-xl transition-all", participantScope === 'selected' ? "bg-emerald-500 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600")}
                >
                  {t.selected}
                </button>
              </div>
            </div>

            <button 
              onClick={handleStartMeeting}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 mt-4"
            >
              <Play className="w-5 h-5" /> {t.start}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={cn("h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden", isRTL ? "rtl" : "ltr")}>
      {/* Header */}
      <header className="flex-none bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-3 sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
            <Brain className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-lg font-bold hidden sm:block">{t.title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={handleEndMeeting}
            className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-all"
          >
            {t.endMeeting}
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Sidebar: Brain Pool */}
        <aside className="w-full lg:w-80 bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col flex-none box-border">
          <div className="p-3 border-b border-slate-800 flex items-center justify-between bg-slate-900">
            <h2 className="font-bold text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-emerald-400" /> {t.brainPool}
            </h2>
          </div>
          
          <div ref={brainPoolRef} className="overflow-y-auto overflow-x-hidden p-3 space-y-3 h-[35vh]">
            {brainPool.length === 0 ? (
              <div className="text-slate-500 text-center py-8">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">{t.noIdeaYet}</p>
              </div>
            ) : (
              brainPool.map((point, idx) => {
                const isCategory = point.includes(']:');
                const [category, content] = isCategory ? point.split(']:') : [null, point];

                return (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={cn(
                      "p-3 rounded-xl border transition-all cursor-pointer",
                      currentIdea === point ? "bg-emerald-500/10 border-emerald-500/50" : "bg-slate-800 border-slate-700 hover:border-slate-600"
                    )}
                    onClick={() => {
                      if (!isCategory) {
                        setCurrentIdea(point);
                        setPhase('idea_discussion');
                      }
                    }}
                  >
                    {category && (
                      <span className="text-[9px] font-bold text-emerald-400 uppercase mb-1 block">
                        {category.replace('[', '')}
                      </span>
                    )}
                    <p className="text-xs leading-relaxed">{content}</p>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Topic Input Area */}
          <div className="p-4 bg-slate-800/50 border-t border-slate-800">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{t.firstIdea}</h3>
            <div className="space-y-3">
              <textarea 
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder={t.topicPlaceholder}
                disabled={!!topic && phase !== 'topic_discussion'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-none h-24 disabled:opacity-50"
              />
              <div className="flex gap-2">
                {!topic ? (
                  <>
                    <button 
                      onClick={handleSetTopic}
                      disabled={!topicInput.trim() || isThinking}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3 h-3" /> {t.start}
                    </button>
                    <button 
                      onClick={handleSuggestFirstIdea}
                      disabled={isThinking}
                      className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
                      title={t.suggestIdea}
                    >
                      <Lightbulb className="w-4 h-4 text-amber-400" />
                    </button>
                  </>
                ) : (
                  <div className="w-full p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-[10px] text-emerald-400 text-center font-bold">
                    {t.phase1Title}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Center: Discussion & Table */}
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-hidden box-border">
          {/* Majlis Table (Agents Grid) */}
          <div className="flex-none p-3 bg-slate-900/30 border-b border-slate-800 box-border w-full max-w-full">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                {phase === 'topic_discussion' ? t.phase1Title : phase === 'idea_generation' ? t.phase2Title : t.phase3Title}
              </span>
              {topic && (
                <span className="text-[10px] font-medium text-emerald-400 truncate max-w-[200px]">
                  {topic}
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10 gap-2 w-full max-w-full">
              {AGENTS.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const isActive = discussions.length > 0 && discussions[discussions.length - 1].agentId === agent.id;
                const Icon = ICON_MAP[agent.icon] || UserCheck;
                
                return (
                  <motion.div 
                    key={agent.id}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedAgentProfile(agent)}
                    className={cn(
                      "relative aspect-square rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all border-2",
                      isSelected ? "bg-slate-800 border-slate-700" : "bg-slate-900/50 border-transparent opacity-40 grayscale",
                      isActive && "border-emerald-500 shadow-lg shadow-emerald-500/20"
                    )}
                  >
                    <Icon className={cn("w-6 h-6 mb-1", isSelected ? "text-emerald-400" : "text-slate-600")} />
                    <span className="text-[8px] text-center font-medium px-1 truncate w-full">
                      {language === 'ar' ? agent.nameAr : agent.nameEn}
                    </span>
                    {isActive && (
                      <motion.div 
                        layoutId="active-indicator"
                        className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Discussion Area */}
          <div className="flex flex-col border-b border-slate-800">
            {/* Discussion Status Indicator */}
            {topic && (
              <div className={cn(
                "flex-none flex items-center justify-center gap-2 py-2 px-4 text-xs font-bold border-b transition-colors",
                discussionStatus === 'discussing' && "bg-yellow-500/10 border-yellow-500/20 text-yellow-400",
                discussionStatus === 'agreed' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                discussionStatus === 'weak' && "bg-red-500/10 border-red-500/20 text-red-400"
              )}>
                <span className="text-base">
                  {discussionStatus === 'discussing' ? '🟡' : discussionStatus === 'agreed' ? '🟢' : '🔴'}
                </span>
                <span>{t.discussionStatus}:</span>
                <span>
                  {discussionStatus === 'discussing'
                    ? t.statusDiscussing
                    : discussionStatus === 'agreed'
                      ? t.statusAgreed
                      : t.statusWeak}
                </span>
              </div>
            )}
            <div 
              ref={scrollRef}
              className="h-[45vh] overflow-y-auto overflow-x-hidden p-4 scroll-smooth chat-bg relative"
            >
              <div className="relative z-10 space-y-4 pb-4">
                {discussions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 py-20">
                    <MessageCircle className="w-16 h-16 mb-4" />
                    <p>{language === 'ar' ? "ابدأ النقاش بإضافة فكرة أولى" : "Start discussion by adding a first idea"}</p>
                  </div>
                ) : (
                  discussions.map((msg, idx) => {
                    const isUserMsg = msg.agentId === 0 && !msg.isSystem;
                    const isSystemMsg = msg.isSystem === true;
                    const agent = (isUserMsg || isSystemMsg) ? null : AGENTS.find(a => a.id === msg.agentId);
                    const Icon = (isUserMsg || isSystemMsg) ? Users : (agent ? (ICON_MAP[agent.icon] || UserCheck) : UserCheck);
                    const agentColor = agent?.color || '#60a5fa';
                    const msgName = isUserMsg ? t.userLabel : (agent ? (language === 'ar' ? agent.nameAr : agent.nameEn) : '');

                    // Process @mentions
                    let displayContent = msg.text || '';
                    if (msg.mentions) {
                      msg.mentions.forEach(m => {
                        const mentionedAgent = AGENTS.find(a => a.nameEn === m || a.nameAr === m);
                        if (mentionedAgent) {
                          displayContent = displayContent.replace(`@${m}`, `**@${m}**`);
                        }
                      });
                    }

                    // System messages (consensus results, focus changes)
                    if (isSystemMsg) {
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex justify-center mb-2"
                        >
                          <div className="bg-[#e2f7cb] text-gray-800 text-xs font-medium rounded-lg py-2 px-4 shadow-sm text-center max-w-[85%]" dir="auto">
                            {msg.text}
                          </div>
                        </motion.div>
                      );
                    }
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={cn(
                          "flex items-start gap-2 mb-1",
                          isUserMsg ? "ml-auto max-w-[70%] flex-row-reverse" : "mr-auto max-w-[70%]"
                        )}
                      >
                        {/* Agent Avatar (only for agent messages) */}
                        {!isUserMsg && agent && (
                          <div 
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-5"
                            style={{ backgroundColor: agentColor + '20' }}
                          >
                            <Icon className="w-4 h-4" style={{ color: agentColor }} />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0 group">
                          {/* Agent Name (only for agent messages) */}
                          {!isUserMsg && (
                            <div className="text-xs font-bold mb-1 px-1" style={{ color: agentColor }}>
                              {msgName}
                            </div>
                          )}
                          
                          {/* Chat Bubble */}
                          <div 
                            className={cn(
                              "relative text-sm shadow-sm rounded-2xl py-2 px-3",
                              isUserMsg 
                                ? "bg-[#DCF8C6] text-gray-900 rounded-tr-sm" 
                                : "bg-[#F1F0F0] text-gray-900 rounded-tl-sm"
                            )}
                            dir="auto"
                          >
                            {/* Reply Quote */}
                            {msg.replyTo && (
                              <div 
                                className={cn(
                                  "mb-2 p-2 rounded-lg text-[10px]",
                                  isUserMsg ? "bg-[#c5e8b0]" : "bg-[#e0dfdf]",
                                  isRTL ? "border-r-4" : "border-l-4"
                                )}
                                style={{ borderColor: msg.replyTo.agentId === 0 ? '#25D366' : AGENTS.find(a => a.id === msg.replyTo!.agentId)?.color || '#999' }}
                              >
                                <div className="font-bold mb-0.5" style={{ color: msg.replyTo.agentId === 0 ? '#25D366' : AGENTS.find(a => a.id === msg.replyTo!.agentId)?.color || '#999' }}>
                                  {msg.replyTo.agentId === 0 
                                    ? t.userLabel
                                    : (language === 'ar' ? AGENTS.find(a => a.id === msg.replyTo!.agentId)?.nameAr : AGENTS.find(a => a.id === msg.replyTo!.agentId)?.nameEn)
                                  }
                                </div>
                                <div className="truncate italic text-gray-600">{msg.replyTo.text}</div>
                              </div>
                            )}
                            
                            <div className="leading-relaxed">
                              <ReactMarkdown>{displayContent}</ReactMarkdown>
                            </div>
                            
                            <div className="text-[9px] mt-1 text-gray-500 text-right">
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                          </div>
                          
                          {/* Hover Actions (agent messages only) */}
                          {!isUserMsg && agent && (
                            <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                              <button 
                                onClick={() => {
                                  setReplyingTo({ agentId: msg.agentId, text: msg.text });
                                  userInputRef.current?.focus();
                                }}
                                className="text-[9px] text-slate-500 hover:text-blue-400 flex items-center gap-1"
                              >
                                <ChevronRight className="w-2.5 h-2.5" /> {t.replyToAgent}
                              </button>
                              <button 
                                onClick={() => {
                                  const name = language === 'ar' ? agent.nameAr : agent.nameEn;
                                  setUserMessage(`@${name} `);
                                  userInputRef.current?.focus();
                                }}
                                className="text-[9px] text-slate-500 hover:text-amber-400 flex items-center gap-1"
                              >
                                <MessageCircle className="w-2.5 h-2.5" /> {t.mentionAgent}
                              </button>
                              <button 
                                onClick={() => setSelectedAgentProfile(agent)}
                                className="text-[9px] text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                              >
                                <Info className="w-2.5 h-2.5" /> {t.agentProfile}
                              </button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
                {isThinking && (
                  <div className="flex items-start gap-2 mr-auto max-w-[70%] mb-1">
                    <div className="w-8 h-8 rounded-full bg-slate-800/50 animate-pulse shrink-0 mt-5" />
                    <div>
                      <div className="w-20 h-3 bg-slate-800/50 rounded animate-pulse mb-2" />
                      <div className="w-48 h-10 bg-[#F1F0F0]/30 rounded-2xl animate-pulse" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User Chat Input */}
            {topic && !isMeetingEnded && (
              <div className="p-3 bg-[#1a2025] border-t border-slate-800">
                {/* Reply indicator */}
                {replyingTo && (
                  <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 px-1">
                    <div className={cn(
                      "flex-1 p-2 rounded-lg border-l-4 bg-slate-800/50 text-[11px]",
                      isRTL && "border-l-0 border-r-4"
                    )} style={{ borderColor: replyingTo.agentId === 0 ? '#60a5fa' : AGENTS.find(a => a.id === replyingTo.agentId)?.color }}>
                      <span className="font-bold" style={{ color: replyingTo.agentId === 0 ? '#60a5fa' : AGENTS.find(a => a.id === replyingTo.agentId)?.color }}>
                        {replyingTo.agentId === 0 ? t.userLabel : (language === 'ar' ? AGENTS.find(a => a.id === replyingTo.agentId)?.nameAr : AGENTS.find(a => a.id === replyingTo.agentId)?.nameEn)}
                      </span>
                      <p className="text-slate-400 truncate mt-0.5">{replyingTo.text}</p>
                    </div>
                    <button onClick={() => setReplyingTo(null)} className="text-slate-500 hover:text-white p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* @Mention Autocomplete Dropdown */}
                {showMentionList && filteredMentionAgents.length > 0 && (
                  <div className="max-w-4xl mx-auto mb-2">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                      {filteredMentionAgents.map(agent => {
                        const Icon = ICON_MAP[agent.icon] || UserCheck;
                        return (
                          <button
                            key={agent.id}
                            onClick={() => handleSelectMention(agent)}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/60 transition-colors text-left"
                          >
                            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: agent.color + '20' }}>
                              <Icon className="w-4 h-4" style={{ color: agent.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-white block truncate">
                                {language === 'ar' ? agent.nameAr : agent.nameEn}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {language === 'ar' ? agent.specialtyAr : agent.specialtyEn}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="max-w-4xl mx-auto flex items-center gap-2">
                  <input
                    ref={userInputRef}
                    type="text"
                    value={userMessage}
                    onChange={handleUserMessageChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (showMentionList && filteredMentionAgents.length > 0) {
                          handleSelectMention(filteredMentionAgents[0]);
                        } else {
                          handleUserSendMessage();
                        }
                      }
                      if (e.key === 'Escape') {
                        if (showMentionList) {
                          setShowMentionList(false);
                        } else {
                          setReplyingTo(null);
                        }
                      }
                    }}
                    placeholder={replyingTo ? (language === 'ar' ? `الرد على ${replyingTo.agentId === 0 ? 'المستخدم' : AGENTS.find(a => a.id === replyingTo.agentId)?.nameAr}...` : `Reply to ${replyingTo.agentId === 0 ? 'User' : AGENTS.find(a => a.id === replyingTo.agentId)?.nameEn}...`) : t.userInputPlaceholder}
                    disabled={isThinking}
                    className="flex-1 bg-[#2a3942] border border-slate-700 rounded-full px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                  />
                  <button
                    onClick={handleUserSendMessage}
                    disabled={!userMessage.trim() || isThinking}
                    className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white rounded-full flex items-center justify-center transition-all shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex-none p-4 bg-slate-900 border-t border-slate-800 sticky bottom-0 z-30">
              <div className="max-w-4xl mx-auto flex flex-col gap-4">
                {/* Phase 2: Idea Display */}
                {phase === 'idea_generation' && generatedIdea && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl"
                  >
                    <p className="text-sm text-emerald-100 mb-3">{generatedIdea}</p>
                    <button 
                      onClick={() => handleAddToBrainPool(generatedIdea)}
                      className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t.addToPool}
                    </button>
                  </motion.div>
                )}

                <div className="flex flex-wrap gap-3 items-center justify-center">
                  {topic && (
                    <>
                      {/* Discussion Focus Badge & Button */}
                      {(phase === 'topic_discussion' || phase === 'idea_discussion') && (
                        <div className="w-full flex items-center justify-center gap-2 mb-1">
                          <div className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold border transition-all",
                            focusDimensionId
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                              : "bg-slate-800/50 border-slate-700 text-slate-500"
                          )}>
                            <Target className="w-4 h-4" />
                            <span>{t.currentFocus}:</span>
                            <span className={cn(focusDimensionId ? "text-amber-300" : "text-slate-400")}>
                              {focusDimensionId
                                ? (language === 'ar'
                                    ? DISCUSSION_DIMENSIONS.find(d => d.id === focusDimensionId)?.ar
                                    : DISCUSSION_DIMENSIONS.find(d => d.id === focusDimensionId)?.en)
                                : t.noFocus}
                            </span>
                          </div>
                          <button
                            onClick={() => setShowFocusSelector(!showFocusSelector)}
                            disabled={isMeetingEnded}
                            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-2xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                          >
                            <Target className="w-3.5 h-3.5" />
                            {t.changeFocus}
                          </button>
                        </div>
                      )}

                      {/* Focus Selector Dropdown */}
                      {showFocusSelector && (phase === 'topic_discussion' || phase === 'idea_discussion') && (
                        <div className="w-full max-w-2xl mx-auto mb-2">
                          <div className="bg-slate-800 border border-amber-500/20 rounded-2xl p-3 shadow-xl">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                                <Target className="w-3.5 h-3.5" /> {t.selectFocus}
                              </span>
                              <button onClick={() => setShowFocusSelector(false)} className="text-slate-500 hover:text-white">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                              {/* Auto/No Focus option */}
                              <button
                                onClick={() => { setFocusDimensionId(null); setShowFocusSelector(false); }}
                                className={cn(
                                  "px-3 py-2 rounded-xl text-[10px] font-medium transition-all text-left border",
                                  !focusDimensionId
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : "bg-slate-700/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                                )}
                              >
                                {t.removeFocus}
                              </button>
                              {DISCUSSION_DIMENSIONS.map(dim => (
                                <button
                                  key={dim.id}
                                  onClick={() => {
                                    setFocusDimensionId(dim.id);
                                    setShowFocusSelector(false);
                                    // Add a system message to show focus change
                                    setDiscussions(prev => [...prev, {
                                      agentId: 0,
                                      text: `🎯 ${t.focusChanged}: ${language === 'ar' ? dim.ar : dim.en}`,
                                      timestamp: Date.now(),
                                      isSystem: true
                                    }]);
                                  }}
                                  className={cn(
                                    "px-3 py-2 rounded-xl text-[10px] font-medium transition-all border",
                                    isRTL ? "text-right" : "text-left",
                                    focusDimensionId === dim.id
                                      ? "bg-amber-500/20 border-amber-500/40 text-amber-400"
                                      : "bg-slate-700/50 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
                                  )}
                                >
                                  {language === 'ar' ? dim.ar : dim.en}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Phase 1 Controls */}
                      {phase === 'topic_discussion' && (
                        <>
                          <button 
                            onClick={handleContinueDiscussion}
                            disabled={isThinking || isAutoPlaying || isMeetingEnded}
                            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold rounded-2xl transition-all flex items-center gap-2"
                          >
                            <RefreshCw className={cn("w-5 h-5", isThinking && "animate-spin")} />
                            {t.continueDiscussion}
                          </button>
                          <button 
                            onClick={handleGenerateIdea}
                            disabled={isThinking || isMeetingEnded}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                          >
                            <CheckCircle2 className="w-5 h-5" /> {t.agreedOnTopic}
                          </button>
                        </>
                      )}

                      {/* Phase 3 Controls */}
                      {phase === 'idea_discussion' && (
                        <>
                          <button 
                            onClick={handleContinueDiscussion}
                            disabled={isThinking || isAutoPlaying || isMeetingEnded}
                            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2"
                          >
                            <RefreshCw className={cn("w-5 h-5", isThinking && "animate-spin")} />
                            {t.continueDiscussion}
                          </button>
                          <button 
                            onClick={handleGenerateIdea}
                            disabled={isThinking || isMeetingEnded}
                            className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2"
                          >
                            <ChevronRight className="w-5 h-5" /> {t.moveToNewIdea}
                          </button>
                        </>
                      )}

                      {/* Common Auto Toggle */}
                      {(phase === 'topic_discussion' || phase === 'idea_discussion') && (
                        <button 
                          onClick={() => {
                            if (isAutoPlaying) {
                              chainActiveRef.current = false;
                              setIsAutoPlaying(false);
                            } else {
                              setIsAutoPlaying(true);
                            }
                          }}
                          disabled={isMeetingEnded}
                          className={cn(
                            "px-6 py-3 font-bold rounded-2xl transition-all flex items-center gap-2 disabled:opacity-50",
                            isAutoPlaying ? "bg-rose-500 hover:bg-rose-600 text-white" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                          )}
                        >
                          {isAutoPlaying ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                          {isAutoPlaying ? t.stopDiscussion : t.startAuto}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

      {/* Modals */}
      <AnimatePresence>
        {selectedAgentProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-800 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-700"
            >
              <div className="bg-emerald-500 p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    {React.createElement(ICON_MAP[selectedAgentProfile.icon] || UserCheck, { className: "w-10 h-10 text-white" })}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {language === 'ar' ? selectedAgentProfile.nameAr : selectedAgentProfile.nameEn}
                    </h2>
                    <p className="text-emerald-100 text-sm">
                      {language === 'ar' ? selectedAgentProfile.specialtyAr : selectedAgentProfile.specialtyEn}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedAgentProfile(null)} className="text-white/80 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Star className="w-3 h-3" /> {t.howContribute}
                  </h3>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    {language === 'ar' ? selectedAgentProfile.contributionAr : selectedAgentProfile.contributionEn}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertCircle className="w-3 h-3" /> {t.whenIntervene}
                  </h3>
                  <p className="text-slate-200 text-sm leading-relaxed">
                    {language === 'ar' ? selectedAgentProfile.triggerAr : selectedAgentProfile.triggerEn}
                  </p>
                </div>
                <div className="pt-4 flex gap-2">
                  <button 
                    onClick={() => {
                      handleEvaluateIdea(selectedAgentProfile);
                      setSelectedAgentProfile(null);
                    }}
                    className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-bold transition-all"
                  >
                    {t.isSuitable}
                  </button>
                  <button 
                    onClick={() => {
                      handleAskAgent(selectedAgentProfile, "How can we improve this?");
                      setSelectedAgentProfile(null);
                    }}
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all"
                  >
                    {t.askAgent}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSummary && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-800"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  <ClipboardList className="w-8 h-8 text-emerald-400" /> {t.summary}
                </h2>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => handleExport('copy')}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                    title="Copy"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => handleExport('txt')}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-all"
                    title="Download TXT"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button onClick={() => setShowSummary(false)} className="text-slate-400 hover:text-white">
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                <div className="prose prose-invert max-w-none">
                  <ReactMarkdown>{summaryContent}</ReactMarkdown>
                </div>

                <div className="border-t border-slate-800 pt-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Star className="w-6 h-6 text-amber-400" /> {t.feedback}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {AGENTS.filter(a => selectedAgentIds.includes(a.id)).map(agent => (
                      <div key={agent.id} className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                            {React.createElement(ICON_MAP[agent.icon] || UserCheck, { className: "w-5 h-5 text-emerald-400" })}
                          </div>
                          <span className="font-bold text-sm">{language === 'ar' ? agent.nameAr : agent.nameEn}</span>
                        </div>
                        <div className="flex items-center gap-4 mb-3">
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 uppercase mb-1">{t.relevance}</p>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                  key={star}
                                  onClick={() => setAgentRatings(prev => ({...prev, [agent.id]: {...(prev[agent.id] || {quality: 0, comment: ""}), relevance: star}}))}
                                  className={cn("w-4 h-4 transition-colors", (agentRatings[agent.id]?.relevance || 0) >= star ? "text-amber-400" : "text-slate-600")}
                                >
                                  <Star className="w-full h-full fill-current" />
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] text-slate-400 uppercase mb-1">{t.contribution}</p>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map(star => (
                                <button 
                                  key={star}
                                  onClick={() => setAgentRatings(prev => ({...prev, [agent.id]: {...(prev[agent.id] || {relevance: 0, comment: ""}), quality: star}}))}
                                  className={cn("w-4 h-4 transition-colors", (agentRatings[agent.id]?.quality || 0) >= star ? "text-amber-400" : "text-slate-600")}
                                >
                                  <Star className="w-full h-full fill-current" />
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <input 
                          type="text"
                          placeholder={t.comment}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                          onChange={(e) => setAgentRatings(prev => ({...prev, [agent.id]: {...(prev[agent.id] || {relevance: 0, quality: 0}), comment: e.target.value}}))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-800 flex gap-4">
                <button 
                  onClick={() => handleExport('pdf')}
                  className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" /> {t.export} (PDF)
                </button>
                <button 
                  onClick={() => setShowSummary(false)}
                  className="px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-2xl transition-all"
                >
                  {t.back}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-800 rounded-3xl w-full max-w-md p-8 shadow-2xl border border-slate-700"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold">{t.setup}</h2>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t.language}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setLanguage('ar')} className={cn("py-2 rounded-xl", language === 'ar' ? "bg-emerald-500" : "bg-slate-700")}>العربية</button>
                    <button onClick={() => setLanguage('en')} className={cn("py-2 rounded-xl", language === 'en' ? "bg-emerald-500" : "bg-slate-700")}>English</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t.style}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setStyle('formal')} className={cn("py-2 rounded-xl", style === 'formal' ? "bg-emerald-500" : "bg-slate-700")}>{t.formal}</button>
                    <button onClick={() => setStyle('omani')} className={cn("py-2 rounded-xl", style === 'omani' ? "bg-emerald-500" : "bg-slate-700")}>{t.omani}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">{t.mode}</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setMode('manual')} className={cn("py-2 rounded-xl", mode === 'manual' ? "bg-emerald-500" : "bg-slate-700")}>{t.manual}</button>
                    <button onClick={() => setMode('auto')} className={cn("py-2 rounded-xl", mode === 'auto' ? "bg-emerald-500" : "bg-slate-700")}>{t.auto}</button>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl mt-4"
                >
                  {t.save}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
