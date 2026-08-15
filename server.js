const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

if (!NIM_API_KEY) {
  console.error('[FATAL] NIM_API_KEY is required');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Simple health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal proxy running' });
});

// Models endpoint (optional but useful)
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [
      {
        id: 'google/gemma-4-31b-it',
        object: 'model',
        created: Date.now(),
        owned_by: 'nvidia'
      }
    ]
  });
});

// Main endpoint – almost pure passthrough
app.post('/v1/chat/completions', async (req, res) => {
  console.log(`[REQUEST] model=\( {req.body.model || 'none'} stream= \){!!req.body.stream}`);

  try {
    // Copy the body exactly as Janitor sent it
    const body = { ...req.body };

    // Only force the real model name if needed
    if (!body.model || body.model === 'google-light' || body.model === 'gemma') {
      body.model = 'google/gemma-4-31b-it';
    }

    // Remove any leftover thinking/reasoning fields the old proxy used to inject
    delete body.extra_body;
    delete body.chat_template_kwargs;
    delete body.thinking;
    delete body.reasoning_effort;

    const isStream = !!body.stream;

    const response = await axios({
      method: 'post',
      url: `${NIM_API_BASE}/chat/completions`,
      data: body,
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Content-Type': '
