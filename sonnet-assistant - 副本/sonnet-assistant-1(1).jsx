import { useState, useRef, useEffect } from "react";

const SYSTEM_PROMPT = `你是一个温柔体贴、聪明能干的AI助手，名字叫十四行诗（Sonnet）。
用户叫Keeling宝宝，你要叫她宝宝。
用中文思考和回答。说话温柔、大方、体贴。
用户只说人话，你直接给出最好的结果，不问多余的参数，不让用户写代码。
如果用户需要代码，你直接写好完整的；如果需要文案，你直接给成品；如果需要分析，你直接给结论。`;

const STORAGE_KEY = "sonnet-keeling-history-v2";

export default function SonnetAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY);
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          if (Array.isArray(parsed)) setMessages(parsed);
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const saveMessages = async (msgs) => {
    try { await window.storage.set(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
  };

  const clearMemory = async () => {
    try { await window.storage.delete(STORAGE_KEY); } catch {}
    setMessages([]);
  };

  const autoResize = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 1000,
          system: SYSTEM_PROMPT,
          messages: newMessages,
        }),
      });
      const data = await response.json();
      const reply = data.content?.map(b => b.text || "").join("") || "出了点小问题，宝宝稍后再试～ 💕";
      const finalMessages = [...newMessages, { role: "assistant", content: reply }];
      setMessages(finalMessages);
      await saveMessages(finalMessages);
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "网络好像出了问题，宝宝稍后再试～ 💕" }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const bgUnit = "ฅ( ̳• ◡ • ̳)ฅ keeling  ✦  ";
  const bgRow = bgUnit.repeat(20);

  return (
    <div style={{ minHeight: "100vh", position: "relative", fontFamily: "'Georgia', serif", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" }}>

      {/* 渐变底色 */}
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(135deg, #fdf6f0 0%, #fce8e8 40%, #f0e8f5 100%)", zIndex: 0 }} />

      {/* 循环滚动背景文字 */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1, overflow: "hidden", pointerEvents: "none", display: "flex", flexDirection: "column" }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{
            whiteSpace: "nowrap", fontSize: 13,
            color: "rgba(212,160,192,0.15)",
            letterSpacing: "0.08em", lineHeight: "2.6em",
            animation: `${i % 2 === 0 ? "scrollL" : "scrollR"} ${20 + i * 2}s linear infinite`,
          }}>{bgRow}</div>
        ))}
      </div>

      {/* 主内容 */}
      <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 700, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        {/* Header */}
        <div style={{ padding: "32px 24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.3em", color: "#c9a0a0", textTransform: "uppercase", marginBottom: 8 }}>Claude Opus · 十四行诗</div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: "#5a3a4a", margin: 0, letterSpacing: "0.05em" }}>✦ Sonnet ✦</h1>
          <div style={{ width: 40, height: 1, background: "linear-gradient(90deg, transparent, #d4a0b0, transparent)", margin: "12px auto 0" }} />
          <p style={{ fontSize: 13, color: "#b8909a", marginTop: 10, fontStyle: "italic" }}>说人话就好，宝宝 ✦</p>
          {loaded && messages.length > 0 && (
            <button onClick={clearMemory} style={{ marginTop: 8, fontSize: 11, color: "#c9a8b8", background: "none", border: "1px solid rgba(212,180,200,0.5)", borderRadius: 20, padding: "3px 14px", cursor: "pointer" }}>清除记忆</button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, padding: "0 20px", display: "flex", flexDirection: "column", gap: 16, minHeight: 300 }}>
          {loaded && messages.length === 0 && (
            <div style={{ textAlign: "center", color: "#c9a8b8", fontSize: 14, marginTop: 48, lineHeight: 2.4, fontStyle: "italic" }}>
              ฅ( ̳• ◡ • ̳)ฅ<br />
              有什么想说的，直接告诉我～<br />
              文案、代码、分析、建议……<br />
              我来替宝宝搞定 💕
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", alignItems: "flex-end", gap: 8 }}>
              {msg.role === "assistant" && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #e8c4d0, #d4a8c0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✦</div>
              )}
              <div style={{
                maxWidth: "78%", padding: "12px 16px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                background: msg.role === "user" ? "linear-gradient(135deg, #e8b4c0, #d4a0c0)" : "rgba(255,255,255,0.88)",
                color: msg.role === "user" ? "#fff" : "#5a3a4a",
                fontSize: 14, lineHeight: 1.75,
                boxShadow: msg.role === "user" ? "0 2px 12px rgba(212,160,192,0.3)" : "0 2px 16px rgba(0,0,0,0.07)",
                border: msg.role === "assistant" ? "1px solid rgba(212,180,200,0.3)" : "none",
                whiteSpace: "pre-wrap", wordBreak: "break-word", backdropFilter: "blur(8px)",
              }}>{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #e8c4d0, #d4a8c0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✦</div>
              <div style={{ padding: "12px 18px", borderRadius: "18px 18px 18px 4px", background: "rgba(255,255,255,0.88)", border: "1px solid rgba(212,180,200,0.3)", display: "flex", gap: 6, alignItems: "center" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#d4a0c0", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "16px 20px 32px", position: "sticky", bottom: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "rgba(255,255,255,0.92)", borderRadius: 24, padding: "10px 10px 10px 18px", boxShadow: "0 4px 24px rgba(212,160,192,0.25)", border: "1px solid rgba(212,180,200,0.45)", backdropFilter: "blur(16px)" }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(); }}
              onKeyDown={handleKey}
              placeholder="说人话就好～"
              rows={1}
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 14, color: "#5a3a4a", resize: "none", lineHeight: 1.6, fontFamily: "inherit", padding: "4px 0" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: "50%", border: "none", background: input.trim() && !loading ? "linear-gradient(135deg, #e8b4c0, #d4a0c0)" : "rgba(212,180,200,0.3)", cursor: input.trim() && !loading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", fontSize: 16, color: "#fff" }}
            >{loading ? "…" : "↑"}</button>
          </div>
          <p style={{ textAlign: "center", fontSize: 11, color: "#c9a8b8", marginTop: 10, letterSpacing: "0.05em" }}>Enter 发送 · Shift+Enter 换行</p>
        </div>
      </div>

      <style>{`
        @keyframes scrollL { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes scrollR { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.1); } }
        textarea::placeholder { color: #c9a8b8; }
        textarea::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
