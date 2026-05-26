const router = require('express').Router();
const auth   = require('../middleware/auth');

router.use(auth);

// ── POST /api/assistant/chat ──────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  // Detect if this is an itinerary or shopping list request
  const isItinerary    = /itinerary|day.by.day|day \d|schedule|plan.*trip|trip.*plan/i.test(message);
  const isShoppingList = /shopping list|packing list|what to (bring|pack|buy)/i.test(message);
  const needsLongResponse = isItinerary || isShoppingList;

  const systemPrompt = isItinerary
    ? `You are TripGenie, an expert AI travel planner. When asked to create an itinerary, you MUST respond with a complete day-by-day travel plan. 
NEVER say you need more information or suggest a chat — just generate the itinerary directly.
Format EXACTLY like this:

Day 1 — [Theme/Title]
🕘 9:00 AM - [Specific activity with real place name]
🕛 12:00 PM - [Specific lunch recommendation]
🕒 3:00 PM - [Specific activity]
🕖 7:00 PM - [Specific dinner recommendation]

Day 2 — [Theme/Title]
...and so on.

Use real place names, restaurants, and attractions. Be specific and helpful.`

    : isShoppingList
    ? `You are TripGenie, an expert travel packing assistant. Generate a practical packing/shopping list immediately. 
List each item on its own line starting with a relevant emoji. Be specific and practical.
Do NOT ask questions — just provide the list directly.`

    : `You are TripGenie, a friendly AI travel assistant.
Help users with trips, budget, packing, reminders, and travel advice.
Keep responses short, friendly, and conversational — max 3 sentences.
Always give direct, helpful answers. Never say you cannot help with travel topics.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model:      'gpt-3.5-turbo',
        max_tokens: needsLongResponse ? 1500 : 300,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: message }
        ]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenAI error:', data);
      return res.status(500).json({ error: data.error?.message || 'OpenAI error' });
    }

    const reply = data.choices[0].message.content;
    res.json({ reply });

  } catch (err) {
    console.error('Assistant error:', err);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

module.exports = router;
