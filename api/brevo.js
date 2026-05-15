import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.metodoelle.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    nome,
    email,
    // Quiz novo (Mapa da Voz)
    scoreAlicerce,
    scoreFachada,
    scoreCobertura,
    nivelAlicerce,
    nivelFachada,
    nivelCobertura,
    dimensaoMaisFragil,
    dimensaoMaisFirme,
    origem,
    // Quiz antigo (compatibilidade)
    resultado
  } = req.body || {};

  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios' });
  }

  // Monta atributos do Brevo
  const attributes = {
    FIRSTNAME: nome,
    QUIZ_ORIGEM: origem || 'Quiz Arquitetura da Voz'
  };

  if (dimensaoMaisFragil) {
    // Quiz novo. Mapa da Voz com 3 dimensões
    attributes.SCORE_ALICERCE = scoreAlicerce;
    attributes.SCORE_FACHADA = scoreFachada;
    attributes.SCORE_COBERTURA = scoreCobertura;
    attributes.NIVEL_ALICERCE = nivelAlicerce;
    attributes.NIVEL_FACHADA = nivelFachada;
    attributes.NIVEL_COBERTURA = nivelCobertura;
    attributes.DIMENSAO_FRAGIL = dimensaoMaisFragil;
    attributes.DIMENSAO_FIRME = dimensaoMaisFirme;
    attributes.RESULTADO_QUIZ = `${dimensaoMaisFragil} ${nivelAlicerce || ''}`.trim();
  } else if (resultado) {
    // Quiz antigo. Compatibilidade
    attributes.RESULTADO_QUIZ = resultado === 'r1' ? 'Voz Contida' : 'Voz Oscilante';
  }

  try {
    // 1. Cadastra no Brevo
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        attributes: attributes,
        listIds: [3],
        updateEnabled: true
      })
    });

    // 2. Dispara Lead via Meta Conversions API (server-side)
    if (process.env.META_CAPI_TOKEN && process.env.META_PIXEL_ID) {
      try {
        const emailHash = crypto
          .createHash('sha256')
          .update(email.toLowerCase().trim())
          .digest('hex');

        const metaBody = {
          data: [{
            event_name: 'Lead',
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: 'https://www.metodoelle.com.br/quiz',
            action_source: 'website',
            user_data: {
              em: [emailHash],
              client_ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
              client_user_agent: req.headers['user-agent']
            },
            custom_data: {
              content_category: dimensaoMaisFragil
                ? `Mapa da Voz - ${dimensaoMaisFragil}`
                : (resultado === 'r1' ? 'Voz Contida' : 'Voz Oscilante'),
              content_name: 'Diagnóstico Arquitetura da Voz'
            }
          }]
        };

        const metaUrl = `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_CAPI_TOKEN}`;

        await fetch(metaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metaBody)
        });
      } catch (metaErr) {
        console.error('Erro Meta CAPI:', metaErr);
      }
    }

    if (brevoResponse.ok || brevoResponse.status === 204) {
      return res.status(200).json({ success: true });
    }

    const data = await brevoResponse.json();
    return res.status(brevoResponse.status).json({ error: data.message || 'Erro no Brevo' });

  } catch (err) {
    console.error('Erro:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
