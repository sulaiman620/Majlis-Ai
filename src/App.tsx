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
import { generateAgentResponse, generateSummary, suggestBestAgents, extractKeyPoints } from './services/geminiService';

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
    mentions?: string[]
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
  const [agentRatings, setAgentRatings] = useState<Record<number, {relevance: number, quality: number, comment: string}>>({});

  const t = TRANSLATIONS[language];
  const isRTL = language === 'ar';

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [discussions, isThinking]);

  // Auto Mode Logic
  useEffect(() => {
    let interval: any;
    if (isAutoPlaying && mode === 'auto' && (topic || currentIdea)) {
      interval = setInterval(() => {
        if (!isThinking) {
          if (phase === 'topic_discussion') {
            handleContinueDiscussion();
          } else if (phase === 'idea_discussion') {
            handleContinueDiscussion();
          }
        }
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, mode, topic, currentIdea, isThinking, phase]);

  const handleStartMeeting = () => {
    setIsStarted(true);
  };

  const handleSetTopic = () => {
    if (!topicInput.trim()) return;
    setTopic(topicInput);
    setPhase('topic_discussion');
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

  const handleContinueDiscussion = async () => {
    if (isThinking || isMeetingEnded) return;
    if (phase === 'topic_discussion' && !topic) return;
    if (phase === 'idea_discussion' && !currentIdea) return;
    if (phase === 'idea_generation') return;

    setIsThinking(true);

    const activeAgents = AGENTS.filter(a => selectedAgentIds.includes(a.id));
    const lastAgentId = discussions.length > 0 ? discussions[discussions.length - 1].agentId : -1;
    const availableAgents = activeAgents.filter(a => a.id !== lastAgentId);
    const agent = availableAgents[Math.floor(Math.random() * availableAgents.length)] || activeAgents[0];

    const history = discussions.slice(-5).map(d => ({
      agentId: d.agentId,
      agentName: language === 'ar' ? AGENTS.find(a => a.id === d.agentId)!.nameAr : AGENTS.find(a => a.id === d.agentId)!.nameEn,
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
        action: phase === 'topic_discussion' ? 'discuss_topic' : 'discuss_idea',
        avoidList
      });

      const newMsg = {
        agentId: agent.id,
        text: response.text,
        timestamp: Date.now(),
        replyTo: response.replyTo,
        mentions: response.mentions
      };

      setDiscussions(prev => [...prev, newMsg]);

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

  const handleAskAgent = async (agent: Agent, question: string) => {
    if (!question.trim() || isThinking || isMeetingEnded) return;
    setIsThinking(true);
    const history = discussions.slice(-5).map(d => ({
      agentId: d.agentId,
      agentName: language === 'ar' ? AGENTS.find(a => a.id === d.agentId)!.nameAr : AGENTS.find(a => a.id === d.agentId)!.nameEn,
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
        userQuestion: question
      });
      
      const newMsg = {
        agentId: agent.id,
        text: response.text,
        timestamp: Date.now(),
        replyTo: response.replyTo,
        mentions: response.mentions
      };
      
      setDiscussions(prev => [...prev, newMsg]);

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
      agentName: language === 'ar' ? AGENTS.find(a => a.id === d.agentId)!.nameAr : AGENTS.find(a => a.id === d.agentId)!.nameEn,
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
        action: 'evaluate'
      });

      const newMsg = {
        agentId: agent.id,
        text: response.text,
        timestamp: Date.now(),
        replyTo: response.replyTo,
        mentions: response.mentions
      };

      setDiscussions(prev => [...prev, newMsg]);

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

  const handleEndMeeting = async () => {
    setIsAutoPlaying(false);
    setIsMeetingEnded(true);
    setIsThinking(true);
    
    const chatHistory = discussions.map(d => {
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
    <div className={cn("min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans", isRTL ? "rtl" : "ltr")}>
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 p-4 sticky top-0 z-40 flex items-center justify-between">
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
        <aside className="w-full lg:w-80 h-[30vh] lg:h-full bg-slate-900 border-r border-slate-800 flex flex-col flex-none">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" /> {t.brainPool}
            </h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 overflow-y-auto lg:overflow-hidden">
          {/* Majlis Table (Agents Grid) */}
          <div className="flex-none p-4 bg-slate-900/30 border-b border-slate-800">
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
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-10 gap-2">
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
          <div className="flex-none flex flex-col border-b border-slate-800">
            <div 
              ref={scrollRef}
              className="h-[55vh] sm:h-[60vh] lg:h-[65vh] overflow-y-auto p-4 scroll-smooth chat-bg relative"
            >
              <div className="relative z-10 space-y-4 pb-4">
                {discussions.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50 py-20">
                    <MessageCircle className="w-16 h-16 mb-4" />
                    <p>{language === 'ar' ? "ابدأ النقاش بإضافة فكرة أولى" : "Start discussion by adding a first idea"}</p>
                  </div>
                ) : (
                  discussions.map((msg, idx) => {
                    const agent = AGENTS.find(a => a.id === msg.agentId)!;
                    const Icon = ICON_MAP[agent.icon] || UserCheck;
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className={cn(
                          "flex flex-col max-w-[85%] sm:max-w-[70%]",
                          isRTL ? "mr-auto items-start" : "ml-auto items-end"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-2 mb-1 px-2",
                          isRTL ? "flex-row" : "flex-row-reverse"
                        )}>
                          <span className="text-[10px] font-bold" style={{ color: agent.color }}>
                            {language === 'ar' ? agent.nameAr : agent.nameEn}
                          </span>
                        </div>
                        
                        <div className="flex gap-2 items-end group">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border border-slate-700/50",
                            isRTL ? "order-1" : "order-2"
                          )} style={{ backgroundColor: agent.color + '20' }}>
                            <Icon className="w-3.5 h-3.5" style={{ color: agent.color }} />
                          </div>
                          
                          <div 
                            className={cn(
                              "relative p-3 rounded-2xl text-sm shadow-sm",
                              isRTL 
                                ? "order-2 bg-[#202c33] text-slate-100 rounded-tl-none" 
                                : "order-1 bg-[#005c4b] text-white rounded-tr-none"
                            )}
                          >
                            <div className="leading-relaxed">
                              {(() => {
                                let content = msg.text;
                                if (msg.mentions) {
                                  msg.mentions.forEach(m => {
                                    const agent = AGENTS.find(a => a.nameEn === m || a.nameAr === m);
                                    if (agent) {
                                      content = content.replace(`@${m}`, `**@${m}**`);
                                    }
                                  });
                                }
                                return (
                                  <>
                                    {msg.replyTo && (
                                      <div 
                                        className={cn(
                                          "mb-2 p-2 bg-black/20 rounded-lg border-l-4 text-[10px] opacity-90",
                                          isRTL ? "border-r-4 border-l-0" : "border-l-4"
                                        )} 
                                        style={{ borderColor: AGENTS.find(a => a.id === msg.replyTo!.agentId)?.color }}
                                      >
                                        <div className="font-bold mb-0.5" style={{ color: AGENTS.find(a => a.id === msg.replyTo!.agentId)?.color }}>
                                          {language === 'ar' ? AGENTS.find(a => a.id === msg.replyTo!.agentId)?.nameAr : AGENTS.find(a => a.id === msg.replyTo!.agentId)?.nameEn}
                                        </div>
                                        <div className="truncate italic">{msg.replyTo.text}</div>
                                      </div>
                                    )}
                                    <ReactMarkdown>{content}</ReactMarkdown>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="text-[9px] mt-1 opacity-50 text-right">
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                            
                            {/* Triangle pointer */}
                            <div className={cn(
                              "absolute top-0 w-0 h-0 border-t-[10px] border-t-transparent",
                              isRTL 
                                ? "-left-2 border-r-[10px] border-r-[#202c33]" 
                                : "-right-2 border-l-[10px] border-l-[#005c4b]"
                            )} />
                          </div>
                        </div>

                        <div className="mt-1 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity px-8">
                          <button 
                            onClick={() => setSelectedAgentProfile(agent)}
                            className="text-[9px] text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                          >
                            <Info className="w-2.5 h-2.5" /> {t.agentProfile}
                          </button>
                          <button 
                            onClick={() => handleAskAgent(agent, "Explain more")}
                            className="text-[9px] text-slate-500 hover:text-emerald-400 flex items-center gap-1"
                          >
                            <MessageSquare className="w-2.5 h-2.5" /> {t.askAgent}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                {isThinking && (
                  <div className={cn("flex flex-col max-w-[85%] sm:max-w-[70%]", isRTL ? "mr-auto items-start" : "ml-auto items-end")}>
                    <div className="w-24 h-4 bg-slate-800/50 rounded animate-pulse mb-2 px-2" />
                    <div className="w-48 h-12 bg-slate-800/50 rounded-2xl animate-pulse" />
                  </div>
                )}
              </div>
            </div>
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
                          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
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
