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
    scoreAlicerce,
    scoreFachada,
    scoreCobertura,
    nivelAlicerce,
    nivelFachada,
    nivelCobertura,
    dimensaoMaisFragil,
    dimensaoMaisFirme,
    origem,
    eventId,
    value,
    currency,
    resultado
  } = req.body || {};

  // Cadastra no Brevo apenas se tiver email
  if (nome && email) {
    try {
      const attributes = {
        FIRSTNAME: nome,
        QUIZ_ORIGEM: origem || 'Diagnóstico da Voz Sob Pressão'
      };

      if (dimensaoMaisFragil) {
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
        attributes.RESULTADO_QUIZ = resultado === 'r1' ? 'Voz Contida' : 'Voz Oscilante';
      }

      await fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify({
          email,
          attributes,
          listIds: [3],
          updateEnabled: true
        })
      });
    } catch (err) {
      console.error('Erro Brevo:', err);
    }
  }

  // Dispara Lead via Meta Conversions API (server-side) com event_id para dedupe
  if (process.env.META_CAPI_TOKEN && process.env.META_PIXEL_ID && dimensaoMaisFragil) {
    try {
      const userData = {
        client_ip_address: req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        client_user_agent: req.headers['user-agent']
      };
      if (email) {
        userData.em = [crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex')];
      }

      const metaBody = {
        data: [{
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId || undefined,
          event_source_url: 'https://www.metodoelle.com.br/quiz',
          action_source: 'website',
          user_data: userData,
          custom_data: {
            content_category: 'Diagnóstico Voz Sob Pressão - ' + dimensaoMaisFragil,
            content_name: 'Diagnóstico da Voz Sob Pressão',
            value: value || 97,
            currency: currency || 'BRL'
          }
        }]
      };

      const metaUrl = `https://graph.facebook.com/v18.0/${process.env.META_PIXEL_ID}/events?access_token=${process.env.META_CAPI_TOKEN}`;

      await fetch(metaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaBody)
      });
    } catch (err) {
      console.error('Erro Meta CAPI:', err);
    }
  }

  return res.status(200).json({ success: true });
}
