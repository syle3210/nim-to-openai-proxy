const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const NIM_API_BASE = process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

if (!NIM_API_KEY) {
  console.error('NIM_API_KEY is required');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Models list (optional, just so Janitor doesn't complain)
app.get('/v1/models', (req, res) => {
  res.json({
    object: 'list',
    data: [{ id: 'google/gemma-4-31b-it', object: 'model', created: Date.now(), owned_by: 'nvidia' }]
  });
});

// Main chat endpoint – pure passthrough
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const body = { ...req.body };

    // Force the real model name if the user typed an alias
    if (body.model === 'google-light' || body.model === 'gemma' || !body.model) {
      body.model = 'google/gemma-4-31b-it';
    }

    // Remove anything the proxy used to inject
    delete body.extra_body;
    delete body.chat_template_kwargs;
    delete body.thinking;
    delete body.reasoning_effort;

    const response = await axios.post(
      `${NIM_API_BASE}/chat/completions`,
      body,
      {
        headers: {
          'Authorization': `Bearer ${NIM_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        responseType: body.stream ? 'stream' : 'json',
        timeout: 180000
      }
    );

    if (body.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || { error: { message: err.message } };
    res.status(status).json(data);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Minimal NIM proxy running on port ${PORT}`);
});
