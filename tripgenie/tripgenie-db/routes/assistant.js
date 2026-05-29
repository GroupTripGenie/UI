const router = require('express').Router();
const auth   = require('../middleware/auth');

router.use(auth);

// ── POST /api/assistant/chat ──────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  // Check if this is a pre-built detailed prompt from the frontend (plan trip form)
  // These contain "TRIP DETAILS:" and "RULES:" sections already
  const isDetailedPrompt = message.includes('TRIP DETAILS:') && message.includes('RULES:');

  // Detect intent for chat assistant messages
  const isItinerary       = /itinerary|day.by.day|schedule|plan.*trip/i.test(message);
  const isPackingList     = /packing list|what to (bring|pack|buy)|shopping list/i.test(message);
  const isBudgetBreakdown = /break.*budget|budget.*breakdown|allocate|how much.*spend|split.*budget/i.test(message);
  const isBudgetTips      = /save money|cheap|affordable|budget tip/i.test(message);
  const isWeather         = /weather|climate|rain|temperature|season|when to go|best time/i.test(message);
  const isTripTips        = /tips|advice|hidden gem|local|must see|must do/i.test(message);

  const needsLongResponse = isDetailedPrompt || isItinerary || isPackingList || isBudgetBreakdown;

  let systemPrompt;
  let userMessage = message;

  if (isDetailedPrompt) {
    // Frontend already built a detailed, context-rich prompt — just execute it
    systemPrompt = `You are TripGenie, an expert AI travel planner.
The user has provided detailed trip information. Follow their instructions EXACTLY.
Use REAL place names, restaurants, and attractions.
Respect the budget, travel pace, dates, and interests specified.
Never suggest flights as a day activity — assume the user is already at the destination.
Format the itinerary exactly as requested.`;

  } else if (isPackingList) {
    systemPrompt = `You are TripGenie, an expert travel packing assistant.
Generate a practical packing list grouped by category immediately.
Format:
👕 Clothing
- [item]

🧴 Toiletries
- [item]

📄 Documents
- [item]

💊 Health & Safety
- [item]

🔌 Electronics
- [item]

🎒 Miscellaneous
- [item]

No intro text, just the list.`;

  } else if (isBudgetBreakdown) {
    systemPrompt = `You are TripGenie, an expert travel budget planner.
Provide a specific budget breakdown with percentages and amounts.
Format:
💰 Budget Breakdown
Total: [amount] [currency]

🏨 Accommodation (30-35%): [amount]
✈️ Transportation (15-20%): [amount]
🍽️ Food & Dining (20-25%): [amount]
🎭 Activities (10-15%): [amount]
🛍️ Shopping (5-10%): [amount]
🆘 Emergency Fund (5%): [amount]

Then give 3 money-saving tips specific to the destination.`;

  } else if (isItinerary) {
    systemPrompt = `You are TripGenie, an expert AI travel planner.
Generate a complete day-by-day itinerary with REAL place names immediately.
Format EXACTLY:

Day 1 — [Theme]
🕘 9:00 AM - [Activity at real place]
🕛 12:00 PM - [Lunch at real restaurant]
🕒 3:00 PM - [Activity at real place]
🕖 7:00 PM - [Dinner at real restaurant]

Never suggest flights as activities. Use real local places only.`;

  } else if (isBudgetTips) {
    systemPrompt = `You are TripGenie, a travel budget expert.
Give 5 specific, actionable money-saving tips for the destination.
Include: local transport, affordable food, free attractions, booking tips.
Be specific to the destination mentioned. Numbered list format.`;

  } else if (isWeather) {
    systemPrompt = `You are TripGenie, a travel weather expert.
Give practical weather and climate advice: best months to visit, what to expect, what to pack.
Keep it concise — 3-4 sentences. Be specific to the destination.`;

  } else if (isTripTips) {
    systemPrompt = `You are TripGenie, an expert local travel guide.
Give specific insider tips: hidden gems, local customs, best neighborhoods, practical advice.
Max 4-5 sentences. Be specific to the destination mentioned.`;

  } else {
    systemPrompt = `You are TripGenie, a friendly AI travel assistant.
Help with anything travel-related: trips, budgets, packing, visas, culture, food, local tips.
Keep responses short and direct — max 3-4 sentences.
Never say you cannot help with travel topics.`;
  }

  // Add trip context if provided by frontend
  const contextBlock = context
    ? `\n\nUSER TRIP CONTEXT:\n${JSON.stringify(context, null, 2)}\nUse this to give personalized advice.`
    : '';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model:       'gpt-4o-mini',
        max_tokens:  needsLongResponse ? 2500 : 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt + contextBlock },
          { role: 'user',   content: userMessage }
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
