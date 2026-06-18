/// <reference path="../pb_data/types.d.ts" />

onBootstrap((e) => {
  e.next();

  const settings = e.app.settings();
  const smtpEnabled = $os.getenv('SMTP_ENABLED') || 'false';

  settings.smtp.enabled = smtpEnabled === 'true';

  if (settings.smtp.enabled) {
    const smtpPort = parseInt($os.getenv('SMTP_PORT') || '587', 10);

    settings.smtp.host = $os.getenv('SMTP_HOST') || 'smtp.resend.com';
    settings.smtp.port = smtpPort;
    settings.smtp.username = $os.getenv('SMTP_USER') || 'resend';
    settings.smtp.password = $os.getenv('SMTP_PASS') || '';
    settings.smtp.tls = smtpPort === 465 || smtpPort === 587;

    const smtpFrom = $os.getenv('SMTP_FROM') || '';

    if (smtpFrom) {
      const emailMatch = smtpFrom.match(/<(.+)>/);
      const nameMatch = smtpFrom.match(/^([^<]+)</);

      if (emailMatch && emailMatch[1]) {
        settings.meta.senderAddress = emailMatch[1].trim();
      }

      if (nameMatch && nameMatch[1]) {
        settings.meta.senderName = nameMatch[1].trim();
      }

      if (!emailMatch && smtpFrom.includes('@')) {
        settings.meta.senderAddress = smtpFrom.trim();
      }
    }
  }

  e.app.save(settings);
  console.log(`SMTP settings synced: enabled=${settings.smtp.enabled}, host=${settings.smtp.host}`);
});
