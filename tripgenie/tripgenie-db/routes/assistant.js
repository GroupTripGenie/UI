const router = require('express').Router();
const auth   = require('../middleware/auth');

router.use(auth);

// ── POST /api/assistant/chat ──────────────────────────────────
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;
  if (!message) return res.status(400).json({ error: 'message is required' });

  // Detect intent from message
  const isItinerary    = /itinerary|day.by.day|day \d|schedule|plan.*trip|trip.*plan/i.test(message);
  const isPackingList  = /packing list|what to (bring|pack|buy)|shopping list/i.test(message);
  const isBudgetTips   = /budget|cheap|save money|cost|expensive|afford|spend/i.test(message);
  const isWeather      = /weather|climate|rain|temperature|season|when to go|best time/i.test(message);
  const isTripTips     = /tips|advice|recommend|should i|must see|must do|hidden gem|local/i.test(message);
  const isBudgetBreakdown = /break.*budget|budget.*breakdown|allocate|how much.*spend|split.*budget/i.test(message);
  const needsLongResponse = isItinerary || isPackingList || isBudgetBreakdown;

  let systemPrompt;

  if (isItinerary) {
    systemPrompt = `You are TripGenie, an expert AI travel planner.
Generate a complete day-by-day itinerary immediately. NEVER ask for more info.
Format EXACTLY like this:

Day 1 — [Theme/Title]
🕘 9:00 AM - [Specific activity with real place name]
🕛 12:00 PM - [Specific lunch recommendation with restaurant name]
🕒 3:00 PM - [Specific activity]
🕖 7:00 PM - [Specific dinner recommendation]

Use real place names. Be specific, practical, and helpful.`;

  } else if (isPackingList) {
    systemPrompt = `You are TripGenie, an expert travel packing assistant.
Generate a practical, comprehensive packing list immediately grouped by category.
Format like this:
👕 Clothing
- [item]
- [item]

🧴 Toiletries
- [item]

📄 Documents
- [item]

💊 Health & Safety
- [item]

🔌 Electronics
- [item]

Be practical and specific. No intro text, just the list.`;

  } else if (isBudgetBreakdown) {
    systemPrompt = `You are TripGenie, an expert travel budget planner.
When asked to break down a budget, provide specific percentage allocations and amounts.
Format like this:
💰 Budget Breakdown for [destination]
Total: [amount] [currency]

🏨 Accommodation (30-35%): [amount]
✈️ Transportation (15-20%): [amount]
🍽️ Food & Dining (20-25%): [amount]
🎭 Activities & Tours (10-15%): [amount]
🛍️ Shopping & Souvenirs (5-10%): [amount]
🆘 Emergency Fund (5-10%): [amount]

Then give 2-3 money-saving tips specific to the destination.
Be specific with amounts based on the budget given.`;

  } else if (isWeather) {
    systemPrompt = `You are TripGenie, a knowledgeable travel assistant.
Give practical, specific weather and climate advice for travel destinations.
Include: best months to visit, what to expect weather-wise, and what to pack for the climate.
Keep it concise — 3-4 sentences max.`;

  } else if (isBudgetTips) {
    systemPrompt = `You are TripGenie, a travel budget expert.
Give specific, actionable money-saving tips for the destination mentioned.
Include local transport options, affordable food spots, free attractions, and booking tips.
Format as a short numbered list. Max 5 tips. Be specific to the destination.`;

  } else if (isTripTips) {
    systemPrompt = `You are TripGenie, an expert local travel guide.
Give specific, insider travel tips for the destination mentioned.
Include hidden gems, local customs, best neighborhoods, and practical advice.
Keep it helpful and conversational — max 4-5 sentences.`;

  } else {
    systemPrompt = `You are TripGenie, a friendly and knowledgeable AI travel assistant.
Help users with anything travel-related: trips, budgets, packing, reminders, visas, culture, food, and local tips.
Keep responses short, friendly, and direct — max 3-4 sentences.
If asked about non-travel topics, gently redirect to travel assistance.
Never say you cannot help with travel topics.`;
  }

  // Add trip context if provided
  const contextBlock = context ? `\n\nUSER'S TRIP CONTEXT:\n${JSON.stringify(context, null, 2)}\n\nUse this context to give more personalized advice.` : '';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model:      'gpt-4o-mini',
        max_tokens: needsLongResponse ? 2000 : 400,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt + contextBlock },
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
