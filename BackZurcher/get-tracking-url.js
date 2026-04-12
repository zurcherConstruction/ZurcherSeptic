require('dotenv').config();
const { NewsletterRecipient, NewsletterSubscriber } = require('./src/data').sequelize.models;

(async () => {
  try {
    const recipient = await NewsletterRecipient.findOne({
      where: { 
        newsletterId: 'b79dcf1e-941b-4e4d-b883-29c942cf7d50' 
      },
      include: [{
        model: NewsletterSubscriber,
        as: 'subscriber'
      }],
      order: [['createdAt', 'DESC']]
    });

    if (recipient) {
      console.log('');
      console.log('🔗 URL del pixel de tracking:');
      console.log(`http://localhost:3001/newsletter/track-open/${recipient.id}`);
      console.log('');
      console.log('📊 Estado actual:');
      console.log(`- Email: ${recipient.subscriber.email}`);
      console.log(`- Status: ${recipient.status}`);
      console.log(`- OpenedAt: ${recipient.openedAt || 'No abierto aún'}`);
      console.log('');
      console.log('📋 Instrucciones:');
      console.log('1. Copiá la URL de arriba');
      console.log('2. Pegala en tu navegador (Chrome/Edge)');
      console.log('3. Si funciona, verás un GIF transparente y el log en el servidor');
    } else {
      console.log('❌ No se encontró el recipient');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();
