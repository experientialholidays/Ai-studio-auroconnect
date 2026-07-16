import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Compass,
  Calendar,
  Clock,
  MapPin,
  Coffee,
  ExternalLink,
  ChevronRight,
  Send,
  X,
  Phone,
  Settings,
  AlertCircle,
  Database,
  Cloud,
  CheckCircle2,
  BookOpen,
  DollarSign,
  Search,
  Globe,
  Users,
  Menu,
  MessageSquare
} from "lucide-react";
import { AuroEvent, ChatMessage, ChatSession } from "./types.js";

const WELCOME_TEXT = `🌟 **Welcome to Auroville Explorer!** 🌟

I am your AI companion, here to help you experience Auroville, not just visit it. 🌿

✨ Auroville is a place to experience yourself and the world differently, to grow, create, and connect. Whether you're here for a day, a week, or longer, immerse yourself through:

🧘 **Deepen within** through meditations, yoga, and talks on Sri Aurobindo's works.
🎨 **Immerse in art** & exhibitions, join pottery, writing, or cultural workshops.
🎶 **Feel the rhythm** with music concerts, choir, and dance classes.
🌱 **Reconnect with nature** in forest walks, permaculture & eco-living workshops.
💆 **Heal and energize** through Ayurveda, Reiki, massage, and movement therapies.
🤝 **Be part of** community learning, volunteering, and sharing circles.

*Just ask me anything or click one of the quick search options below!*`;

const SUGGESTED_QUERIES = [
  { text: "What's happening today? 📅", query: "What's happening today?" },
  { text: "Savitri Reading Circle 📖", query: "Savitri reading circle" },
  { text: "Yoga & Healing 🧘", query: "Water yoga and meditation" },
  { text: "Bamboo workshop 🎋", query: "bamboo workshop" },
  { text: "Horse therapy 🐴", query: "Horse assisted therapy" }
];

const DAYS_OF_WEEK = [
  "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
];

export default function App() {
  const [activeTab, setActiveTab] = useState<"chat" | "catalog">("chat");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  
  // Visual Catalog States
  const [catalogEvents, setCatalogEvents] = useState<AuroEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDay, setSearchDay] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);

  // Detail Modal State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<AuroEvent | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Miscellaneous States
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Local & Drive Settings
  const [showSettings, setShowSettings] = useState(false);
  const [localFiles, setLocalFiles] = useState<{ name: string; size: number; modifiedAt: string; eventCount: number }[]>([]);
  const [localDirectory, setLocalDirectory] = useState("AuroConnect-main/input");
  const [isLoadingLocalFiles, setIsLoadingLocalFiles] = useState(false);
  const driveFolderId = "15l0mDptMPRTReB0t014Zo-oEeIehrTnn";

  const fetchLocalFiles = async () => {
    setIsLoadingLocalFiles(true);
    try {
      const res = await fetch("/api/local-files");
      const data = await res.json();
      if (data.success) {
        setLocalFiles(data.files || []);
        if (data.directoryPath) {
          setLocalDirectory(data.directoryPath);
        }
      }
    } catch (err) {
      console.error("Error fetching local files:", err);
    } finally {
      setIsLoadingLocalFiles(false);
    }
  };

  useEffect(() => {
    if (showSettings) {
      fetchLocalFiles();
    }
  }, [showSettings]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
    useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamedText]);

  // Load chat sessions from local storage
  useEffect(() => {
    const saved = localStorage.getItem("auroconnect_sessions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessions(parsed);
        if (parsed.length > 0) {
          const lastActiveId = localStorage.getItem("auroconnect_active_session_id") || parsed[0].id;
          setActiveSessionId(lastActiveId);
          const activeSession = parsed.find((s: any) => s.id === lastActiveId) || parsed[0];
          setMessages(activeSession.messages);
        } else {
          startNewSession();
        }
      } catch (e) {
        startNewSession();
      }
    } else {
      startNewSession();
    }
    
    // Load visual catalog
    fetchCatalogEvents();
  }, []);

  // Fetch Excel visual catalog list
  const fetchCatalogEvents = async (query = "", day = "", category = "") => {
    setIsCatalogLoading(true);
    try {
      let url = `/api/events?query=${encodeURIComponent(query)}&day=${encodeURIComponent(day)}&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setCatalogEvents(data.events);
      }
    } catch (e) {
      console.error("Error loading events database:", e);
    } finally {
      setIsCatalogLoading(false);
    }
  };

  // Trigger search on catalog filters change
  useEffect(() => {
    if (activeTab === "catalog") {
      fetchCatalogEvents(searchQuery, searchDay, searchCategory);
    }
  }, [searchQuery, searchDay, searchCategory, activeTab]);

  // Load selected event details
  useEffect(() => {
    if (selectedEventId) {
      setIsDetailLoading(true);
      fetch(`/api/events/${selectedEventId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setSelectedEvent(data.event);
          }
        })
        .catch((e) => console.error("Error fetching event details:", e))
        .finally(() => setIsDetailLoading(false));
    } else {
      setSelectedEvent(null);
    }
  }, [selectedEventId]);

  // Save sessions to local storage
  const saveSessions = (updated: ChatSession[]) => {
    setSessions(updated);
    localStorage.setItem("auroconnect_sessions", JSON.stringify(updated));
  };

  const startNewSession = () => {
    const defaultSession: ChatSession = {
      id: "sess_" + Math.random().toString(36).substring(2, 11),
      title: "Discover Auroville",
      messages: [
        {
          id: "welcome_msg",
          role: "assistant",
          content: WELCOME_TEXT,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        }
      ],
      createdAt: new Date().toLocaleString()
    };
    const updated = [defaultSession, ...sessions.filter(s => s.messages.length > 1)];
    setSessions(updated);
    setActiveSessionId(defaultSession.id);
    setMessages(defaultSession.messages);
    localStorage.setItem("auroconnect_sessions", JSON.stringify(updated));
    localStorage.setItem("auroconnect_active_session_id", defaultSession.id);
  };

  const switchSession = (id: string) => {
    const session = sessions.find((s) => s.id === id);
    if (session) {
      setActiveSessionId(id);
      setMessages(session.messages);
      localStorage.setItem("auroconnect_active_session_id", id);
    }
    setShowMobileSidebar(false);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = sessions.filter((s) => s.id !== id);
    if (updated.length === 0) {
      localStorage.removeItem("auroconnect_sessions");
      localStorage.removeItem("auroconnect_active_session_id");
      startNewSession();
    } else {
      saveSessions(updated);
      if (activeSessionId === id) {
        switchSession(updated[0].id);
      }
    }
  };

  // Send Chat message
  const handleSendMessage = async (textToSend?: string) => {
    const rawText = textToSend || inputText;
    if (!rawText.trim() || isLoading) return;

    if (!textToSend) setInputText("");

    const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMessage: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substring(2, 11),
      role: "user",
      content: rawText,
      timestamp
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Update active session memory
    const updatedSessions = sessions.map((s) => {
      if (s.id === activeSessionId) {
        // Infer title from first user query
        const title = s.title === "Discover Auroville" ? rawText.slice(0, 30) + (rawText.length > 30 ? "..." : "") : s.title;
        return { ...s, title, messages: updatedMessages };
      }
      return s;
    });
    saveSessions(updatedSessions);

    // Prepare endpoint streaming fetch
    setIsLoading(true);
    setStreamedText("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Select last 10 messages for sliding window context
        body: JSON.stringify({ messages: updatedMessages.slice(-10) })
      });

      if (!response.ok) {
        let errorMsg = "Application error occurred.";
        try {
           const errData = await response.json();
           if (errData.error) errorMsg = errData.error;
        } catch { }
        throw new Error(errorMsg);
      }

      if (!response.body) throw new Error("Null response stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";
      let rawDataBuffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        rawDataBuffer += decoder.decode(value, { stream: true });
        const lines = rawDataBuffer.split("\n");
        rawDataBuffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.chunk) {
                streamBuffer += parsed.chunk;
                setStreamedText(streamBuffer);
              }
            } catch (err) {
              // Non-fatal parse failure
            }
          }
        }
      }

      // Finalize message append
      if (streamBuffer) {
        const assistantMessage: ChatMessage = {
          id: "msg_" + Math.random().toString(36).substring(2, 11),
          role: "assistant",
          content: streamBuffer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };
        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);

        const savedSessions = sessions.map((s) => {
          if (s.id === activeSessionId) {
            return { ...s, messages: finalMessages };
          }
          return s;
        });
        saveSessions(savedSessions);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: "err_" + Date.now(),
          role: "assistant",
          content: "⚠️ **Connection Error.** Please check your local server or environment API configuration and try again.",
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsLoading(false);
      setStreamedText("");
    }
  };

  const handleSelectEventById = (id: string) => {
    setSelectedEventId(id);
  };

  // Custom renderer component to replace raw a-[#DETAILS] anchors with interactive buttons
  const markdownComponents = {
    a: ({ href, children }: any) => {
      if (href?.startsWith("#DETAILS::")) {
        const id = href.split("::")[1];
        return (
          <button
            onClick={() => handleSelectEventById(id)}
            className="text-amber-500 hover:text-amber-600 transition-colors cursor-pointer decoration-dotted underline hover:decoration-solid font-semibold inline-flex items-center gap-0.5"
          >
            {children} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-emerald-600 hover:text-emerald-700 font-medium underline flex-inline items-center gap-1"
        >
          {children} <ExternalLink className="w-3 h-3 inline pb-0.5" />
        </a>
      );
    }
  };

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!feedbackText.trim()) return;
    setFeedbackSent(true);
    setTimeout(() => {
      setShowFeedback(false);
      setFeedbackText("");
      setFeedbackSent(false);
    }, 1800);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Decorative ambient gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 left-10 w-80 h-80 bg-amber-100/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Top Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4 md:px-8 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowMobileSidebar(true)}
            className="p-1 md:hidden bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5">
                AuroConnect
              </h1>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider font-mono">Auroville AI Guide</p>
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("chat")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "chat"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Chat Explorer
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "catalog"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            Catalog Browser
          </button>
        </div>

        {/* Support Link */}
        <div className="hidden md:flex items-center gap-3">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer"
            title="Database Source Data"
          >
            <Database className="w-5 h-5" />
          </button>
          <a
            href="https://rzp.io/rzp/AuroConnect"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-slate-600 hover:text-amber-600 flex items-center gap-1 border border-slate-200/80 px-3 py-1.5 bg-slate-50/50 hover:bg-amber-50 hover:border-amber-200 rounded-xl transition-all"
          >
            <Coffee className="w-3.5 h-3.5 text-amber-500 fill-amber-100" />
            Buy me a coffee
          </a>
        </div>
      </header>

      {/* Main Structural Body */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* SIDEBAR: Saved Sessions (hidden on mobile, overlayed on trigger) */}
        <aside
          className={`w-72 border-r border-slate-200 bg-white/50 backdrop-blur-xs flex-col shrink-0 fixed inset-y-0 left-0 z-50 md:sticky md:top-[73px] md:h-[calc(100vh-73px)] ${
            showMobileSidebar ? "flex" : "hidden"
          } md:flex`}
        >
          {/* Sidebar overlay backdrop on mobile */}
          {showMobileSidebar && (
            <div
              className="fixed inset-0 bg-slate-900/40 z-[-1] md:hidden"
              onClick={() => setShowMobileSidebar(false)}
            />
          )}

          <div className="p-4 flex items-center justify-between border-b border-slate-100">
            <span className="text-xs font-bold font-mono text-slate-400 tracking-wider">CHATS & EVENTS</span>
            {showMobileSidebar && (
              <button
                onClick={() => setShowMobileSidebar(false)}
                className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="p-3">
            <button
              onClick={startNewSession}
              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold leading-none flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:shadow-md transition-all"
            >
              Start New Chat
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto px-2 space-y-1">
            {sessions.map((sess) => {
              const isActive = sess.id === activeSessionId;
              return (
                <div
                  key={sess.id}
                  onClick={() => switchSession(sess.id)}
                  className={`w-full p-2.5 rounded-xl text-left text-xs font-medium flex items-start gap-2.5 group transition-colors cursor-pointer ${
                    isActive
                      ? "bg-slate-100 text-slate-900"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <MessageSquare className={`w-4 h-4 mt-0.5 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-semibold text-slate-800 leading-tight">{sess.title}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{sess.messages.length} replies</p>
                  </div>
                  {sess.messages.length > 1 && (
                    <button
                      onClick={(e) => deleteSession(sess.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-rose-50 hover:text-rose-600 rounded text-slate-400 transition-opacity cursor-pointer ml-auto"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar Footer Info */}
          <div className="p-4 border-t border-slate-100 space-y-2 mt-auto">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-100 rounded-full">
                DATABASE CONNECTED
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              AuroConnect uses AI over official spreadsheets to curate verified activities.
            </p>
          </div>
        </aside>

        {/* CENTRAL VIEW AREA */}
        <main className="flex-1 flex flex-col overflow-hidden">
          
          {/* TAB 1: Conversational Chat */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col overflow-hidden relative">
              
              {/* Chat Message Box */}
              <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
                
                {messages.map((msg) => {
                  const isAssistant = msg.role === "assistant";
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isAssistant ? "justify-start" : "justify-end"} items-start gap-3`}
                    >
                      {isAssistant && (
                        <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 mt-1 shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                      )}
                      
                      <div className="flex flex-col max-w-[85%] md:max-w-[75%] space-y-1">
                        <div
                          className={`p-4 rounded-2xl shadow-xs leading-relaxed text-sm ${
                            isAssistant
                              ? "bg-white border border-slate-100 text-slate-800"
                              : "bg-emerald-600 text-white"
                          }`}
                        >
                          <div className={`prose prose-sm prose-emerald max-w-none ${isAssistant ? "text-slate-800" : "text-white"}`}>
                            <ReactMarkdown components={markdownComponents}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                        <span className={`text-[10px] text-slate-400 px-2 ${!isAssistant && "text-right"}`}>
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Simulated Stream Loader */}
                {isLoading && (
                  <div className="flex justify-start items-start gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800 mt-1 animate-pulse shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col max-w-[85%] md:max-w-[75%] space-y-1">
                      <div className="p-4 rounded-2xl bg-white border border-slate-100 text-slate-800 shadow-xs">
                        {streamedText ? (
                          <div className="prose prose-sm prose-emerald max-w-none text-slate-800">
                            <ReactMarkdown components={markdownComponents}>
                              {streamedText}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce shrink-0" />
                            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce shrink-0 [animation-delay:0.2s]" />
                            <span className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce shrink-0 [animation-delay:0.4s]" />
                            <span className="font-medium font-mono">Assistant is reading spreadsheet events...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions row inside Chat tab */}
              {messages.length === 1 && (
                <div className="px-4 py-2 border-t border-slate-100 bg-white/40">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 px-1">Suggested prompts</p>
                  <div className="flex flex-wrap gap-1.5">
                    {SUGGESTED_QUERIES.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(item.query)}
                        className="px-3 py-1.5 bg-white border border-slate-200/80 hover:border-emerald-500 rounded-xl text-xs font-semibold text-slate-600 hover:text-emerald-700 flex items-center gap-1 cursor-pointer hover:shadow-xs transition-colors"
                      >
                        {item.text}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Chat Send Area Input */}
              <div className="p-4 bg-white border-t border-slate-250 flex items-center gap-3">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendMessage();
                  }}
                  placeholder="Ask about music, meditation, yoga, pottery workshops..."
                  className="flex-1 bg-slate-50 border border-slate-200 outline-none p-3 rounded-2xl text-sm focus:bg-white focus:border-slate-400 transition-all placeholder:text-slate-400"
                />
                <button
                  onClick={() => handleSendMessage()}
                  disabled={isLoading}
                  className="p-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl cursor-pointer shadow-xs active:scale-95 transition-all text-xs font-bold leading-none shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}

          {/* TAB 2: Visual Event Catalog Search Browser */}
          {activeTab === "catalog" && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
              
              {/* Event Filters */}
              <div className="bg-white p-4 border-b border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative flex items-center">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, category, workshop or description..."
                    className="w-full bg-slate-100 border border-transparent outline-none p-2 pl-9 rounded-xl text-xs focus:bg-white focus:border-slate-300 transition-all text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <div className="flex gap-2">
                  <select
                    value={searchDay}
                    onChange={(e) => setSearchDay(e.target.value)}
                    className="bg-slate-100 border border-transparent text-xs font-semibold text-slate-600 p-2 rounded-xl outline-none focus:bg-white focus:border-slate-350 cursor-pointer"
                  >
                    <option value="">Any Day</option>
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>

                  <select
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                    className="bg-slate-100 border border-transparent text-xs font-semibold text-slate-600 p-2 rounded-xl outline-none focus:bg-white focus:border-slate-350 cursor-pointer"
                  >
                    <option value="">All Categories</option>
                    <option value="Date-specific Events">Date-specific Events</option>
                    <option value="Weekly Events">Weekly Events</option>
                    <option value="Daily Events">Daily Events</option>
                  </select>

                  {(searchQuery || searchDay || searchCategory) && (
                    <button
                      onClick={() => {
                        setSearchQuery("");
                        setSearchDay("");
                        setSearchCategory("");
                      }}
                      className="px-2.5 text-xs text-rose-500 hover:bg-rose-50 rounded-xl transition-colors font-semibold flex items-center cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Event Catalog Listing Grid */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6">
                
                {isCatalogLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 space-y-2">
                    <span className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin shrink-0" />
                    <span className="text-xs text-slate-400 font-mono">Loading events spreadsheet database...</span>
                  </div>
                ) : catalogEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center bg-white rounded-3xl border border-slate-200">
                    <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
                    <h3 className="font-bold text-slate-800">No events matched</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      We couldn't find events matching these filter parameters. Try another keyword or change your category selection.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catalogEvents.map((event) => (
                      <div
                        key={event.id}
                        className="bg-white p-5 border border-slate-200 hover:border-slate-300 rounded-2xl flex flex-col justify-between shadow-xs hover:shadow-md hover:scale-[1.01] transition-all group"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-[9px] font-bold font-mono tracking-wider uppercase px-2 py-0.5 border rounded-md shrink-0 ${
                              event.category === "Date-specific Events"
                                ? "bg-amber-50 text-amber-800 border-amber-100"
                                : event.category === "Weekly Events"
                                ? "bg-purple-50 text-purple-800 border-purple-100"
                                : "bg-emerald-50 text-emerald-800 border-emerald-100"
                            }`}>
                              {event.category.replace(" Events", "")}
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium truncate max-w-[120px]">{event.type}</span>
                          </div>

                          <h3 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-1.5">{event.title}</h3>
                          
                          <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{event.description || "No description provided."}</p>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-100 mt-4">
                          <div className="space-y-1.5 text-[11px] text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{event.dates || event.days}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{event.times}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{event.venue}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSelectEventById(event.id)}
                            className="w-full py-1.5 px-3 bg-slate-50 hover:bg-emerald-50 group-hover:bg-emerald-600 border border-slate-200 hover:border-emerald-500 group-hover:border-emerald-600 text-slate-700 group-hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            Details & Registration
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Humble Page Footer Disclaimer */}
          <footer className="bg-white border-t border-slate-200 py-3.5 px-4 flex flex-col sm:flex-row items-center justify-between text-center gap-2.5 z-10">
            <span className="text-[10px] text-slate-400 font-medium italic">
              “AuroConnect is not affiliated with the Auroville Foundation or any Auroville unit.”
            </span>
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowFeedback(true)}
                className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 underline cursor-pointer"
              >
                Feedback & Report
              </button>
              <span className="text-slate-300">•</span>
              <a
                href="https://forms.gle/R6FQ7esBXx7qyuDeA"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-bold text-slate-500 hover:text-emerald-700 underline flex items-center gap-0.5"
              >
                Submit Event <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </footer>

        </main>
      </div>

      {/* MODAL / SHEET: Beautiful Sliding Event Detail Sheet */}
      <AnimatePresence>
        {selectedEventId && (
          <div className="fixed inset-0 z-50 flex justify-end">
            
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setSelectedEventId(null)}
            />

            {/* Event Details Content Sheet */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white h-full shadow-2xl flex flex-col z-10"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold font-mono text-slate-400 tracking-wider">EVENT DESCRIPTION</span>
                <button
                  onClick={() => setSelectedEventId(null)}
                  className="p-1.5 hover:bg-slate-100 text-slate-500 rounded-xl cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {isDetailLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-2">
                  <span className="w-8 h-8 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin shrink-0" />
                  <span className="text-xs text-slate-400 font-mono">Fetching full record details...</span>
                </div>
              ) : selectedEvent ? (
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
                  
                  {/* Category badging */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] font-bold font-mono tracking-widest uppercase px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-full">
                      {selectedEvent.category}
                    </span>
                    <span className="text-[10px] font-bold font-mono tracking-widest uppercase px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-full">
                      {selectedEvent.type}
                    </span>
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-extrabold text-slate-900 leading-tight">{selectedEvent.title}</h2>

                  {/* Quick Meta Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        DATES & DAYS
                      </span>
                      <p className="text-xs font-semibold text-slate-700 truncate">{selectedEvent.dates || selectedEvent.days}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 font-mono flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        TIMING
                      </span>
                      <p className="text-xs font-semibold text-slate-700 truncate">{selectedEvent.times}</p>
                    </div>
                  </div>

                  {/* Full Information Column List */}
                  <div className="space-y-4">
                    
                    {/* Venue Location info */}
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 font-mono uppercase">Venue / Location</h4>
                        <p className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">{selectedEvent.venue}</p>
                      </div>
                    </div>

                    {/* Contribution/Cost info */}
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-amber-50 text-amber-800 rounded-lg shrink-0 mt-0.5">
                        <DollarSign className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 font-mono uppercase">Contribution & Cost</h4>
                        <p className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">{selectedEvent.cost || "Donation / Free based"}</p>
                      </div>
                    </div>

                    {/* Target audience */}
                    <div className="flex gap-3 items-start">
                      <div className="p-2 bg-purple-50 text-purple-800 rounded-lg shrink-0 mt-0.5">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-400 font-mono uppercase">Prerequisites & Audience</h4>
                        <p className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">{selectedEvent.audience || "All residents, visitors and guests welcome"}</p>
                      </div>
                    </div>

                    {/* Contact detail */}
                    {selectedEvent.contact && (
                      <div className="flex gap-3 items-start">
                        <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0 mt-0.5">
                          <Phone className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-[10px] font-bold text-slate-400 font-mono uppercase">Contact Organizer</h4>
                          <p className="text-sm font-semibold text-slate-800 leading-snug mt-0.5">{selectedEvent.contact}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Poster Image or visual fall back banner if URL is valid */}
                  {selectedEvent.posterUrl && selectedEvent.posterUrl.startsWith("http") ? (
                    <div className="p-2 border border-slate-100 rounded-2xl bg-slate-50 overflow-hidden relative group">
                      <img
                        src={selectedEvent.posterUrl}
                        alt={selectedEvent.title}
                        referrerPolicy="no-referrer"
                        className="w-full max-h-[220px] object-cover rounded-xl group-hover:scale-[1.01] transition-transform duration-300"
                        onError={(e) => {
                          // Hide on render failure gracefully
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="py-6 px-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-1">
                      <BookOpen className="w-7 h-7 text-slate-300" />
                      <span className="text-[10px] text-slate-400 font-medium">Verify event specifics directly with coordinator</span>
                    </div>
                  )}

                  {/* Core Description block details */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-extrabold uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                      Description
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 border border-slate-100 rounded-2xl whitespace-pre-line">
                      {selectedEvent.description || "No granular description provided for this catalog row entry."}
                    </p>
                  </div>

                  {/* Sliding Sheet Action Bar */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
                    
                    {/* Send WhatsApp Msg */}
                    {selectedEvent.whatsapp && (
                      <a
                        href={`https://wa.me/${selectedEvent.whatsapp}?text=${encodeURIComponent(
                          `Hi, I found your event "${selectedEvent.title}" scheduling on AuroConnect. I would like more information please!`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs hover:shadow-md transition-all whitespace-nowrap cursor-pointer decoration-0"
                      >
                        <Phone className="w-4 h-4 fill-white" />
                        Message on WhatsApp
                      </a>
                    )}

                    {/* Official website Link */}
                    {selectedEvent.website && (
                      <a
                        href={selectedEvent.website.startsWith("http") ? selectedEvent.website : `https://${selectedEvent.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors whitespace-nowrap cursor-pointer decoration-0"
                      >
                        <Globe className="w-4 h-4 text-emerald-600" />
                        Official Website
                      </a>
                    )}
                  </div>

                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                  <X className="w-8 h-8 text-rose-500 animate-ping mb-2" />
                  <h4 className="font-bold">Record Loading Fault</h4>
                </div>
              )}
            </motion.div>

          </div>
        )}
      </AnimatePresence>

      {/* MODAL: Optional Feedback Dialog */}
      <AnimatePresence>
        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setShowFeedback(false)}
            />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white p-6 rounded-3xl shadow-xl space-y-4 z-10"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Send Feedback</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Submit concerns, event fixes, or missing rows</p>
                </div>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="p-1 hover:bg-slate-100 text-slate-500 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {feedbackSent ? (
                <div className="flex flex-col items-center justify-center py-6 text-center space-y-2">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 animate-bounce" />
                  <h4 className="font-bold text-slate-800">Feedback Submitted</h4>
                  <p className="text-xs text-slate-400 max-w-xs">Thank you! Our Auroville organizers appreciate your service.</p>
                </div>
              ) : (
                <form onSubmit={handleSendFeedback} className="space-y-4">
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    required
                    placeholder="Enter your request, error description or missing event detail here..."
                    rows={4}
                    className="w-full text-xs bg-slate-50 border border-slate-200 focus:bg-white focus:border-slate-400 outline-none p-3.5 rounded-2xl resize-none placeholder:text-slate-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                  >
                    Submit Report
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL / SHEET: Data Source Settings */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex justify-center items-center">
            
            {/* Backdrop cover */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs"
              onClick={() => setShowSettings(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col z-10 m-4 overflow-hidden border border-slate-100"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Database className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-bold text-slate-800">Database Source Settings</span>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-xl cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 space-y-6 overflow-y-auto max-h-[85vh]">
                <div>
                  <h3 className="font-bold text-slate-900 mb-1 flex items-center gap-2 text-base">
                    📁 Active Database Files (Local Workspace)
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mb-4">
                    The app loads all events and schedules locally from Excel spreadsheets inside your project directory. Update the files in your editor workspace to instantly update the event database.
                  </p>

                  {isLoadingLocalFiles ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                      Querying local files...
                    </div>
                  ) : localFiles.length === 0 ? (
                    <div className="p-4 bg-amber-50 text-amber-800 text-xs rounded-xl flex items-start gap-2 border border-amber-100">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>No local Excel files found in the <code>/AuroConnect-main/input</code> folder. Please place some spreadsheet files there.</span>
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/50">
                      <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider p-3 bg-slate-100 border-b border-slate-250">
                        <div className="col-span-6">File Name</div>
                        <div className="col-span-3 text-right">Size</div>
                        <div className="col-span-3 text-right">Events</div>
                      </div>
                      <div className="divide-y divide-slate-100 bg-white">
                        {localFiles.map((file, i) => {
                          const formatBytes = (b: number) => {
                            if (b === 0) return '0 B';
                            const k = 1024;
                            const sizes = ['B', 'KB', 'MB'];
                            const idx = Math.floor(Math.log(b) / Math.log(k));
                            return parseFloat((b / Math.pow(k, idx)).toFixed(1)) + ' ' + sizes[idx];
                          };
                          return (
                            <div key={i} className="grid grid-cols-12 gap-2 text-xs text-slate-700 p-3 items-center hover:bg-slate-50/50">
                              <div className="col-span-6 font-medium text-slate-800 truncate flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate font-mono text-[11px]" title={file.name}>{file.name}</span>
                              </div>
                              <div className="col-span-3 text-right text-slate-500 font-mono text-[11px]">
                                {formatBytes(file.size)}
                              </div>
                              <div className="col-span-3 text-right">
                                <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 font-semibold px-2 py-0.5 rounded-full text-[10px] border border-emerald-100">
                                  {file.eventCount}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Explanation Section */}
                  <div className="mt-5 space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">1</span>
                        Where is the local folder?
                      </div>
                      <p className="text-xs text-slate-600 pl-6 leading-relaxed">
                        The Excel master spreadsheets are read directly from your sandboxed workspace directory at: <br />
                        <code className="text-xs font-mono bg-white px-2 py-1 rounded border border-slate-200 inline-block mt-1 text-emerald-800 font-semibold">
                          /AuroConnect-main/input/
                        </code>
                      </p>
                    </div>

                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                        <span className="bg-emerald-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">2</span>
                        How do I modify or upload files?
                      </div>
                      <div className="text-xs text-slate-600 pl-6 leading-relaxed space-y-1.5">
                        <p>You can manage and view files using Google AI Studio's sidebar panel:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Click on the **File Explorer** icon in your left workspace panel.</li>
                          <li>Open the folder named <code className="bg-white border border-slate-200 px-1 rounded">AuroConnect-main</code> and then expand the <code className="bg-white border border-slate-200 px-1 rounded">input</code> folder.</li>
                          <li>**To Upload**: Right-click on the <code className="bg-slate-100 px-1 rounded">input</code> directory to upload, or simply drag and drop your new Excel files (<code className="font-semibold select-all text-slate-800">.xlsx</code>) directly into it.</li>
                          <li>**To Remove**: Right-click or hover on any of the sheet files inside the list and select **Delete**.</li>
                          <li>The application instantly auto-reloads and indexes the updated spreadsheets!</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
