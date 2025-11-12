import express from "express";
import fetch from "node-fetch";

const router = express.Router();

router.post("/", async (req, res) => {
  const { message, conversationHistory = [] } = req.body;

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required and must be a string" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OpenAI API key not configured" });
  }

  try {
    const messages = [
      { 
        role: "system", 
        content: "You are Nyomi AI, a smart, kind, and helpful assistant. You provide thoughtful, accurate, and friendly responses to help users with their questions and tasks." 
      },
      ...conversationHistory,
      { role: "user", content: message }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: messages,
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("OpenAI API Error:", errorData);
      return res.status(response.status).json({ 
        error: errorData.error?.message || "Failed to get response from AI" 
      });
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      return res.status(500).json({ error: "Invalid response from AI" });
    }

    res.json({ 
      reply: data.choices[0].message.content,
      usage: data.usage
    });
  } catch (error) {
    console.error("Chat endpoint error:", error);
    res.status(500).json({ 
      error: "AI server error. Please try again later." 
    });
  }
});

export default router;
