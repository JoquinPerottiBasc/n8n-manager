import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { getTelegramToken } from './config.js';

// sessionId de Claude Code por chatId (para continuar conversaciones)
const sessions = new Map();
// Directorio de trabajo por chatId
const cwds = new Map();
// Chats que están esperando respuesta
const processing = new Set();

function getCwd(chatId) {
  return cwds.get(chatId) || process.cwd();
}

function runClaude(message, sessionId, cwd) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', message,
      '--output-format', 'json',
      '--dangerously-skip-permissions',
    ];
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    console.log(`[claude] ejecutando: claude ${args.join(' ')}`);
    console.log(`[claude] cwd: ${cwd}`);

    const proc = spawn('claude', args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,  // necesario en Windows para encontrar claude.cmd
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d; process.stdout.write(`[claude stdout] ${d}`); });
    proc.stderr.on('data', (d) => { stderr += d; process.stderr.write(`[claude stderr] ${d}`); });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error('Timeout: Claude tardó más de 3 minutos'));
    }, 180000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      console.log(`[claude] proceso terminó con código: ${code}`);
      console.log(`[claude] stdout total: ${stdout.length} chars`);
      if (code !== 0) {
        reject(new Error(`Claude terminó con error:\n${stderr || stdout || `código ${code}`}`));
        return;
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          text: parsed.result ?? stdout,
          sessionId: parsed.session_id ?? null,
        });
      } catch {
        // Si no es JSON válido, devolver el texto plano
        resolve({ text: stdout.trim() || '(sin respuesta)', sessionId: null });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo ejecutar claude: ${err.message}`));
    });
  });
}

export function startBot() {
  const token = getTelegramToken();
  const bot = new TelegramBot(token, { polling: true });

  console.log('Bot de Telegram iniciado. Ctrl+C para detener.');

  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Hola! Soy tu Claude Code en Telegram.\n\n` +
      `Escribime lo que necesitás y lo ejecuto en tu computadora.\n\n` +
      `Comandos:\n` +
      `/clear — reinicia la conversación\n` +
      `/cwd — muestra el directorio actual\n` +
      `/cd <ruta> — cambia el directorio\n` +
      `/status — estado de la sesión`
    );
  });

  bot.onText(/\/clear/, (msg) => {
    const chatId = msg.chat.id;
    sessions.delete(chatId);
    cwds.delete(chatId);
    bot.sendMessage(chatId, 'Conversación reiniciada.');
  });

  bot.onText(/\/cwd/, (msg) => {
    bot.sendMessage(msg.chat.id, `Directorio actual:\n\`${getCwd(msg.chat.id)}\``, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/cd (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const newPath = match[1].trim();
    const resolved = resolve(getCwd(chatId), newPath);
    if (existsSync(resolved)) {
      cwds.set(chatId, resolved);
      bot.sendMessage(chatId, `Directorio cambiado a:\n\`${resolved}\``, { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(chatId, `El directorio no existe: ${resolved}`);
    }
  });

  bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const sessionId = sessions.get(chatId);
    bot.sendMessage(
      chatId,
      `Estado:\n` +
      `• Directorio: \`${getCwd(chatId)}\`\n` +
      `• Sesión: ${sessionId ? `\`${sessionId.slice(0, 8)}...\`` : 'nueva'}`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (!msg.text || msg.text.startsWith('/')) return;

    if (processing.has(chatId)) {
      bot.sendMessage(chatId, 'Todavía estoy procesando, esperá un momento...');
      return;
    }

    processing.add(chatId);

    // Mantener el indicador "escribiendo..." activo
    bot.sendChatAction(chatId, 'typing');
    const typingInterval = setInterval(() => {
      bot.sendChatAction(chatId, 'typing').catch(() => {});
    }, 4000);

    try {
      const result = await runClaude(
        msg.text,
        sessions.get(chatId) ?? null,
        getCwd(chatId)
      );

      // Guardar el session ID para continuar la conversación
      if (result.sessionId) {
        sessions.set(chatId, result.sessionId);
      }

      clearInterval(typingInterval);
      await sendLongMessage(bot, chatId, result.text);
    } catch (err) {
      clearInterval(typingInterval);
      await bot.sendMessage(chatId, `Error: ${err.message}`);
    } finally {
      processing.delete(chatId);
    }
  });

  bot.on('polling_error', (err) => {
    console.error('Error de polling:', err.message);
  });

  return bot;
}

async function sendLongMessage(bot, chatId, text) {
  const MAX = 4000;
  if (!text) return;

  if (text.length <= MAX) {
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' })
      .catch(() => bot.sendMessage(chatId, text));
    return;
  }

  const parts = [];
  let rest = text;
  while (rest.length > 0) {
    parts.push(rest.slice(0, MAX));
    rest = rest.slice(MAX);
  }
  for (let i = 0; i < parts.length; i++) {
    const chunk = `(${i + 1}/${parts.length})\n${parts[i]}`;
    await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' })
      .catch(() => bot.sendMessage(chatId, chunk));
  }
}
