import { useState, useRef, useEffect } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface AIAssistantPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const INITIAL_GREETING: Message = {
  id: "greeting",
  role: "assistant",
  content:
    "Ask me anything about editing your article! I can help you with:\n\n• Improving readability and grammar\n• Making content more engaging\n• Changing tone and style\n• Reorganizing sections\n• Expanding or condensing content\n\nWhat would you like help with?",
};

export function AIAssistantPanel({
  isOpen,
  onClose,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const generateAIResponse = (userMessage: string): string => {
    const lowerMessage = userMessage.toLowerCase();

    if (
      lowerMessage.includes("improve") ||
      lowerMessage.includes("better") ||
      lowerMessage.includes("enhance")
    ) {
      return "I can help improve your content! Here are some suggestions:\n\n• Break long paragraphs into shorter ones\n• Use active voice instead of passive\n• Add transition words between sentences\n• Include specific examples\n• Use powerful verbs\n\nTry highlighting text in your article and ask me to improve specific sections!";
    }

    if (lowerMessage.includes("grammar") || lowerMessage.includes("spell")) {
      return "For grammar and spelling:\n\n• Check for consistent tense usage\n• Ensure subject-verb agreement\n• Remove redundant phrases\n• Fix common punctuation mistakes\n\nShare the text you'd like me to review and I'll help!";
    }

    if (
      lowerMessage.includes("tone") ||
      lowerMessage.includes("formal") ||
      lowerMessage.includes("casual")
    ) {
      return "I can help adjust your writing tone! Tell me:\n\n• Should it be more formal or casual?\n• Is it for professionals or general audience?\n• What emotion or mood should it convey?\n\nWith this info, I can suggest specific changes to match your desired tone.";
    }

    if (
      lowerMessage.includes("length") ||
      lowerMessage.includes("shorter") ||
      lowerMessage.includes("longer")
    ) {
      return "For adjusting content length:\n\n• To make it shorter: Remove examples, combine sentences, use concise language\n• To make it longer: Add details, include examples, expand explanations\n\nWhat specific sections would you like to adjust?";
    }

    if (lowerMessage.includes("seo") || lowerMessage.includes("keyword")) {
      return "For SEO optimization:\n\n• Include your target keyword naturally in the first 100 words\n• Use it in headers and subheaders\n• Create descriptive meta descriptions\n• Use related keywords throughout\n• Ensure good readability for both users and search engines\n\nWhat's your target keyword?";
    }

    if (lowerMessage.includes("help") || lowerMessage.includes("what can you")) {
      return INITIAL_GREETING.content;
    }

    return "That's a great question! I can help with various editing tasks. Could you be more specific about what you need? For example:\n\n• Improving specific sections\n• Changing the tone\n• Making it more or less technical\n• Enhancing readability\n• Grammar and spelling fixes\n\nWhat would help you most?";
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Simulate a slight delay for better UX
    setTimeout(() => {
      const assistantResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generateAIResponse(input),
      };
      setMessages((prev) => [...prev, assistantResponse]);
      setIsLoading(false);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 flex flex-col border-l border-border/50 bg-white overflow-hidden min-h-0">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-400 rounded-lg">
            <MessageCircle className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-semibold text-base">AI Assistant</h2>
            <p className="text-blue-100 text-xs">Help with editing</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="h-8 w-8 p-0 text-white hover:bg-blue-700"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-6 bg-white/50">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div
              className={cn(
                "max-w-xs rounded-lg px-4 py-2 text-sm whitespace-pre-wrap leading-relaxed",
                message.role === "user"
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-white text-foreground border border-border rounded-bl-none"
              )}
            >
              {message.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex-shrink-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse" />
            </div>
            <div className="bg-white border border-border text-foreground rounded-lg px-4 py-2 rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border/30 px-6 py-4 bg-white shrink-0">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={isLoading}
            className="flex-1 bg-white border-border/50 text-foreground placeholder-muted-foreground focus:ring-blue-500"
          />
          <Button
            type="submit"
            size="sm"
            disabled={isLoading || !input.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
