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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Minimal proxy running' });
});

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

app.post('/v1/chat/completions', async (req, res) => {
  console.log('[REQUEST] model=' + (req.body.model || 'none') + ' stream=' + !!req.body.stream);

  try {
    const body = { ...req.body };

    if (!body.model || body.model === 'google-light' || body.model === 'gemma') {
      body.model = 'google/gemma-4-31b-it';
    }

    delete body.extra_body;
    delete body.chat_template_kwargs;
    delete body.thinking;
    delete body.reasoning_effort;

    const isStream = !!body.stream;

    const response = await axios({
      method: 'post',
      url: NIM_API_BASE + '/chat/completions',
      data: body,
      headers: {
        'Authorization': 'Bearer ' + NIM_API_KEY,
        'Content-Type': 'application/json',
        'Accept': isStream ? 'text/event-stream' : 'application/json'
      },
      responseType: isStream ? 'stream' : 'json',
      timeout: 300000,
      validateStatus: () => true
    });

    res.status(response.status);

    if (isStream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      response.data.pipe(res);
    } else {
      res.json(response.data);
    }

  } catch (err) {
    console.error('[ERROR]', err.message);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(500).json({
        error: {
          message: err.message || 'Proxy error',
          type: 'proxy_error'
        }
      });
    }
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Minimal NIM proxy running on port ' + PORT);
});
