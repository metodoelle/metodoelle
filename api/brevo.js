export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.metodoelle.com.br');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { nome, email, resultado } = req.body;

  if (!nome || !email) {
    return res.status(400).json({ error: 'Nome e email são obrigatórios' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY
      },
      body: JSON.stringify({
        email: email,
        attributes: {
          FIRSTNAME: nome,
          RESULTADO_QUIZ: resultado === 'r1' ? 'Voz Contida' : 'Voz Oscilante',
          QUIZ_ORIGEM: 'Quiz Arquitetura da Voz'
        },
        listIds: [3],
        updateEnabled: true
      })
    });

    if (response.ok || response.status === 204) {
      return res.status(200).json({ success: true });
    }

    const data = await response.json();
    return res.status(response.status).json({ error: data.message || 'Erro no Brevo' });

  } catch (err) {
    return res.status(500).json({ error: 'Erro interno' });
  }
}
