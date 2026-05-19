const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs    = require('fs');
const path  = require('path');
const https = require('https');

const config = require('./config.json');

// Enregistre la police Montserrat si disponible
const fontPath = path.join(__dirname, 'Montserrat.ttf');
if (fs.existsSync(fontPath)) {
  GlobalFonts.registerFromPath(fontPath, 'Montserrat');
  console.log('Police Montserrat chargee');
}

const FONT = fs.existsSync(fontPath) ? 'Montserrat' : 'sans-serif';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

const DATA_FILE = path.join(__dirname, 'seen_members.json');

function loadSeenMembers() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return {}; }
}

function saveSeenMembers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) { ctx.moveTo(x, y); } else { ctx.lineTo(x, y); }
  }
  ctx.closePath();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function generateWelcomeImage(member) {
  const W = 1000, H = 420;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#0a0718');
  bg.addColorStop(0.5, '#120d2e');
  bg.addColorStop(1,   '#0a0718');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  const border = ctx.createLinearGradient(0, 0, W, H);
  border.addColorStop(0,   '#7c3aed');
  border.addColorStop(0.5, '#06b6d4');
  border.addColorStop(1,   '#7c3aed');
  ctx.strokeStyle = border;
  ctx.lineWidth   = 5;
  roundRect(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.stroke();

  const ax = 200;
  const ay = H / 2;
  const hexR = 130;
  const hexRing = hexR + 8;

  const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, hexRing + 40);
  halo.addColorStop(0,   'rgba(124,58,237,0.45)');
  halo.addColorStop(0.5, 'rgba(6,182,212,0.15)');
  halo.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ax, ay, hexRing + 40, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(6,182,212,0.35)';
  ctx.lineWidth   = 14;
  hexPath(ctx, ax, ay, hexRing + 6);
  ctx.stroke();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth   = 4;
  hexPath(ctx, ax, ay, hexRing + 6);
  ctx.stroke();

  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatarBuf = await fetchBuffer(avatarURL);
    const avatarImg = await loadImage(avatarBuf);
    ctx.save();
    hexPath(ctx, ax, ay, hexR);
    ctx.clip();
    ctx.drawImage(avatarImg, ax - hexR, ay - hexR, hexR * 2, hexR * 2);
    ctx.restore();
  } catch (e) {
    ctx.save();
    hexPath(ctx, ax, ay, hexR);
    ctx.clip();
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(ax - hexR, ay - hexR, hexR * 2, hexR * 2);
    ctx.restore();
    ctx.fillStyle = 'white';
    ctx.font = 'bold 90px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(member.user.username[0].toUpperCase(), ax, ay);
    ctx.textBaseline = 'alphabetic';
  }

  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth   = 5;
  hexPath(ctx, ax, ay, hexR);
  ctx.stroke();

  const textX = 370;
  ctx.textAlign = 'left';

  ctx.font      = 'bold 28px ' + FONT;
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('--  BIENVENUE  --', textX, H / 2 - 115);

  const username = member.user.username;
  ctx.font        = 'bold 88px ' + FONT;
  ctx.fillStyle   = '#ffffff';
  ctx.shadowColor = '#7c3aed';
  ctx.shadowBlur  = 28;
  ctx.fillText('@' + username, textX, H / 2 + 5);
  ctx.shadowBlur  = 0;

  const lineGrad = ctx.createLinearGradient(textX, 0, textX + 600, 0);
  lineGrad.addColorStop(0,   '#7c3aed');
  lineGrad.addColorStop(0.5, '#06b6d4');
  lineGrad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.strokeStyle = lineGrad;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(textX, H / 2 + 26);
  ctx.lineTo(textX + 600, H / 2 + 26);
  ctx.stroke();

  ctx.font      = 'bold 34px ' + FONT;
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('sur le serveur  MCjules99 club !', textX, H / 2 + 80);

  ctx.font      = '28px ' + FONT;
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Amuse toi bien ! :)', textX, H / 2 + 128);

  ctx.font      = '20px ' + FONT;
  ctx.fillStyle = '#4a5568';
  ctx.fillText('Membre #' + member.guild.memberCount, textX, H / 2 + 168);

  return canvas.toBuffer('image/png');
}

client.once('clientReady', () => {
  console.log('Bot connecte : ' + client.user.tag);
  console.log('Salon : ' + config.welcomeChannelId);
  client.user.setActivity('les nouveaux joueurs', { type: 3 });
});

client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  const userId  = member.user.id;
  const seen    = loadSeenMembers();
  const key     = guildId + ':' + userId;

  if (seen[key]) { return; }

  seen[key] = new Date().toISOString();
  saveSeenMembers(seen);

  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) { return; }

  try {
    const imageBuffer = await generateWelcomeImage(member);
    const attachment  = new AttachmentBuilder(imageBuffer, { name: 'bienvenue.png' });
    await channel.send({ content: '<@' + userId + '>', files: [attachment] });
    console.log('Bienvenue envoye pour ' + member.user.tag);
  } catch (err) {
    console.error('Erreur :', err);
  }
});

client.login(process.env.TOKEN || config.token).catch((err) => {
  console.error('Impossible de se connecter a Discord :', err.message);
  process.exit(1);
});
