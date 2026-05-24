const Imap = require('imap');
const { simpleParser } = require('mailparser');

// CORS 处理
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 连接 IMAP 并获取邮件列表
function fetchEmails({ host, port, user, password, count = 20 }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user,
      password,
      host,
      port: parseInt(port) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    const emails = [];

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) { imap.end(); return reject(err); }

        const total = box.messages.total;
        if (total === 0) { imap.end(); return resolve([]); }

        // 取最新 N 封
        const start = Math.max(1, total - count + 1);
        const fetch = imap.seq.fetch(`${start}:${total}`, {
          bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
          struct: true,
        });

        fetch.on('message', (msg, seqno) => {
          const email = { seqno, headers: {}, snippet: '' };

          msg.on('body', (stream, info) => {
            let buffer = '';
            stream.on('data', chunk => buffer += chunk.toString('utf8'));
            stream.once('end', () => {
              if (info.which.includes('HEADER')) {
                const parsed = Imap.parseHeader(buffer);
                email.subject = parsed.subject?.[0] || '(无主题)';
                email.from = parsed.from?.[0] || '';
                email.to = parsed.to?.[0] || '';
                email.date = parsed.date?.[0] || '';
              } else {
                // 取前 300 字符作为预览
                const clean = buffer
                  .replace(/=\r?\n/g, '')
                  .replace(/=[0-9A-Fa-f]{2}/g, '')
                  .replace(/<[^>]+>/g, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                email.snippet = clean.slice(0, 300);
              }
            });
          });

          msg.once('attributes', attrs => {
            email.uid = attrs.uid;
            email.flags = attrs.flags;
          });

          msg.once('end', () => emails.push(email));
        });

        fetch.once('error', err => { imap.end(); reject(err); });
        fetch.once('end', () => imap.end());
      });
    });

    imap.once('error', err => reject(err));
    imap.once('end', () => resolve(emails.reverse())); // 最新在前
    imap.connect();
  });
}

// 获取单封邮件完整内容
function fetchEmailBody({ host, port, user, password, uid }) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user, password, host,
      port: parseInt(port) || 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 15000,
      authTimeout: 10000,
    });

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err) => {
        if (err) { imap.end(); return reject(err); }

        const fetch = imap.fetch(uid, { bodies: '', uid: true });
        let rawEmail = '';

        fetch.on('message', msg => {
          msg.on('body', stream => {
            stream.on('data', chunk => rawEmail += chunk.toString('utf8'));
          });
        });

        fetch.once('error', err => { imap.end(); reject(err); });
        fetch.once('end', async () => {
          imap.end();
          try {
            const parsed = await simpleParser(rawEmail);
            resolve({
              subject: parsed.subject || '',
              from: parsed.from?.text || '',
              to: parsed.to?.text || '',
              date: parsed.date?.toISOString() || '',
              text: parsed.text || '',
              html: parsed.html || '',
            });
          } catch (e) {
            reject(e);
          }
        });
      });
    });

    imap.once('error', err => reject(err));
    imap.connect();
  });
}

module.exports = async (req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 从请求体或环境变量取配置
  let config = {};
  try {
    if (req.method === 'POST') {
      config = req.body || {};
    } else {
      config = req.query;
    }
  } catch (e) {
    return res.status(400).json({ error: '请求格式错误' });
  }

  // 优先使用请求参数，否则回退到环境变量
  const {
    host = process.env.IMAP_HOST,
    port = process.env.IMAP_PORT,
    user = process.env.IMAP_USER,
    password = process.env.IMAP_PASSWORD,
    action,
    uid,
    count
  } = config;

  if (!host || !user || !password) {
    return res.status(400).json({ error: '缺少必要参数：host, user, password（可通过请求体或环境变量提供）' });
  }

  try {
    if (action === 'fetch' && uid) {
      // 获取单封邮件完整内容
      const email = await fetchEmailBody({ host, port, user, password, uid: parseInt(uid) });
      return res.status(200).json({ success: true, email });
    } else {
      // 获取邮件列表
      const emails = await fetchEmails({ host, port, user, password, count: parseInt(count) || 20 });
      return res.status(200).json({ success: true, emails });
    }
  } catch (err) {
    console.error('IMAP Error:', err.message);
    return res.status(500).json({ error: err.message || 'IMAP 连接失败' });
  }
};
