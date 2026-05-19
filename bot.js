const { Client, GatewayIntentBits, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('@napi-rs/canvas');
const fs   = require('fs');
const path = require('path');
const https = require('https');

// ─── Configuration ───────────────────────────────────────────────────────────
const config = require('./config.json');

// ─── Client Setup ─────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

// ─── Fichier de persistance (joueurs déjà vus) ───────────────────────────────
const DATA_FILE = path.join(__dirname, 'seen_members.json');

function loadSeenMembers() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return {}; }
}

function saveSeenMembers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ─── Téléchargement de l'avatar en Buffer ────────────────────────────────────
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

// ─── Trace un hexagone centré en (cx, cy) de rayon r ────────────────────────
function hexPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ─── Génération de l'image de bienvenue ──────────────────────────────────────
async function generateWelcomeImage(member) {
  const W = 1000, H = 420;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // ── Fond dégradé sombre ──────────────────────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0,   '#0a0718');
  bg.addColorStop(0.5, '#120d2e');
  bg.addColorStop(1,   '#0a0718');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Étoiles ──────────────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Bordure dégradée ─────────────────────────────────────────────────────
  const border = ctx.createLinearGradient(0, 0, W, H);
  border.addColorStop(0,   '#7c3aed');
  border.addColorStop(0.5, '#06b6d4');
  border.addColorStop(1,   '#7c3aed');
  ctx.strokeStyle = border;
  ctx.lineWidth   = 5;
  roundRect(ctx, 6, 6, W - 12, H - 12, 22);
  ctx.stroke();

  // ── Position avatar ───────────────────────────────────────────────────────
  const ax = 200;           // centre x de l'hexagone (décalé à droite)
  const ay = H / 2;         // centre y
  const hexR = 130;         // rayon de l'hexagone (avatar)
  const hexRing = hexR + 8; // rayon du contour néon

  // Halo radial derrière
  const halo = ctx.createRadialGradient(ax, ay, 0, ax, ay, hexRing + 40);
  halo.addColorStop(0,   'rgba(124,58,237,0.45)');
  halo.addColorStop(0.5, 'rgba(6,182,212,0.15)');
  halo.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(ax, ay, hexRing + 40, 0, Math.PI * 2);
  ctx.fill();

  // Contour extérieur néon (double trait)
  ctx.strokeStyle = 'rgba(6,182,212,0.35)';
  ctx.lineWidth   = 14;
  hexPath(ctx, ax, ay, hexRing + 6);
  ctx.stroke();

  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth   = 4;
  hexPath(ctx, ax, ay, hexRing + 6);
  ctx.stroke();

  // Clip hexagonal + dessin de l'avatar
  try {
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    const avatarBuf = await fetchBuffer(avatarURL);
    const avatarImg = await loadImage(avatarBuf);

    ctx.save();
    hexPath(ctx, ax, ay, hexR);
    ctx.clip();
    ctx.drawImage(avatarImg, ax - hexR, ay - hexR, hexR * 2, hexR * 2);
    ctx.restore();
  } catch {
    // Fallback violet avec initiale
    ctx.save();
    hexPath(ctx, ax, ay, hexR);
    ctx.clip();
    ctx.fillStyle = '#2d1b69';
    ctx.fillRect(ax - hexR, ay - hexR, hexR * 2, hexR * 2);
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = 'bold 90px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(member.user.username[0].toUpperCase(), ax, ay);
    ctx.textBaseline = 'alphabetic';
  }

  // Contour intérieur sur l'avatar (dessus du clip)
  ctx.strokeStyle = '#7c3aed';
  ctx.lineWidth   = 5;
  hexPath(ctx, ax, ay, hexR);
  ctx.stroke();

  // ── Textes ────────────────────────────────────────────────────────────────
  const textX = 370;
  ctx.textAlign = 'left';

  // -- BIENVENUE --
  ctx.font      = 'bold 28px sans-serif';
  ctx.fillStyle = '#06b6d4';
  ctx.fillText('--  BIENVENUE  --', textX, H / 2 - 115);

  // @username  — très grand
  const username = member.user.username;
  ctx.font        = 'bold 90px sans-serif';
  ctx.fillStyle   = '#ffffff';
  ctx.shadowColor = '#7c3aed';
  ctx.shadowBlur  = 28;
  ctx.fillText(`@${username}`, textX, H / 2 + 5);
  ctx.shadowBlur  = 0;

  // Ligne décorative
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

  // sur le serveur MCjules99 club !
  ctx.font      = 'bold 36px sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('sur le serveur  MCjules99 club !', textX, H / 2 + 80);

  // Amuse toi bien !
  ctx.font      = '30px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Amuse toi bien ! :)', textX, H / 2 + 128);

  // Membre #N
  ctx.font      = '22px sans-serif';
  ctx.fillStyle = '#4a5568';
  ctx.fillText(`Membre #${member.guild.memberCount}`, textX, H / 2 + 168);

  return canvas.toBuffer('image/png');
}

// ─── Helper : rectangle arrondi ──────────────────────────────────────────────
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

// ─── Événement : bot prêt ─────────────────────────────────────────────────────
client.once('ready', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  console.log(`📢 Salon de bienvenue : #${config.welcomeChannelId}`);
  client.user.setActivity('les nouveaux joueurs 👀', { type: 3 });
});

// ─── Événement : nouveau membre ───────────────────────────────────────────────
client.on('guildMemberAdd', async (member) => {
  const guildId = member.guild.id;
  const userId  = member.user.id;

  const seen = loadSeenMembers();
  const key  = `${guildId}:${userId}`;

  if (seen[key]) {
    console.log(`ℹ️  ${member.user.tag} a déjà rejoint — pas de message.`);
    return;
  }

  seen[key] = new Date().toISOString();
  saveSeenMembers(seen);

  const channel = member.guild.channels.cache.get(config.welcomeChannelId);
  if (!channel) {
    console.error(`❌ Salon introuvable : ${config.welcomeChannelId}`);
    return;
  }

  try {
    console.log(`🎨 Génération de l'image pour ${member.user.tag}…`);
    const imageBuffer = await generateWelcomeImage(member);
    const attachment  = new AttachmentBuilder(imageBuffer, { name: 'bienvenue.png' });

    await channel.send({
      content: `<@${userId}>`,
      files: [attachment],
    });

    console.log(`🎉 Message de bienvenue envoyé pour ${member.user.tag}`);
  } catch (err) {
    console.error(`❌ Erreur lors de l'envoi du message :`, err);
  }
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
client.login(process.env.TOKEN || config.token)
  console.error('❌ Impossible de se connecter à Discord :', err.message);
  process.exit(1);
});
