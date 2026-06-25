export interface AuroEvent {
  id: string;
  title: string;
  type: string;
  days: string; // e.g. "Monday, Thursday" or '["Monday", "Thursday"]'
  dates: string; // original raw date text / numbers
  times: string; // e.g. "5:30 PM"
  venue: string; // venue name
  category: "Date-specific Events" | "Weekly Events" | "Daily Events";
  description: string;
  contact?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  cost?: string;
  audience?: string;
  pageNo?: number;
  posterUrl?: string;
  source: string; // filename source
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}

export interface SearchQueryResponse {
  searchQuery: string;
  filterDay?: string;
  filterDate?: string;
  specificity: "broad" | "specific";
}
