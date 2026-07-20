require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  await new Promise(r => setTimeout(r, 1500));

  const { getOwnerSock, isOwnerConnected } = require('./services/ownerWhatsapp');
  const { Channel } = require('./database/models');

  console.log('Owner WA connected:', isOwnerConnected());
  const sock = getOwnerSock();

  if (!sock) {
    console.log('ERROR: No owner sock — is owner WA paired?');
    process.exit(1);
  }

  const inviteCode = '0029VbCSVL9HLHQgReyVeE39';

  // Step 1: Resolve newsletter JID
  try {
    console.log('Resolving newsletter JID from invite code...');
    const meta = await sock.newsletterMetadata('invite', inviteCode);
    console.log('JID:', meta?.id);
    console.log('Name:', meta?.name);

    if (meta?.id) {
      await Channel.findOneAndUpdate(
        { link: { $regex: inviteCode } },
        { chatId: meta.id, title: meta.name || 'Pappy Mythic' },
        { upsert: false }
      );
      console.log('Channel DB updated with real JID:', meta.id);
    }
  } catch (e) {
    console.log('newsletterMetadata error:', e.message);
    console.log('Will try sending with invite code directly');
  }

  // Step 2: Test sending a message to the channel
  const ch = await Channel.findOne({ platform: 'whatsapp', isActive: true });
  if (!ch) { console.log('No WA channel in DB'); process.exit(1); }

  const jid = ch.chatId || ch.link;
  console.log('Sending test message to JID:', jid);

  try {
    await sock.sendMessage(jid, { text: '🧪 Test drop from Pappy PFP bot — WA channel connected!' });
    console.log('SUCCESS: Test message sent to WA channel');
  } catch (e) {
    console.log('sendMessage error:', e.message);
  }

  mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
