const { v4: uuidv4 } = require('uuid');
const postmark = require('postmark');
var client = new postmark.ServerClient(process.env.MAIL_API_KEY);

async function initVerification({ user_id, fastify}) {
  try {

    const connection = await fastify.mysql.getConnection();

    const [user] = await connection.query(
      'SELECT * FROM user WHERE verified = false AND id = ?', [user_id])

    if (user.length === 0) {
        throw new Error({
            success: false,
            code: 'ALREADY_VERIFIED',
            message: 'User is already verified or does not exist.'
        });
    }

    const verificationId = uuidv4();
    const expiration = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    await connection.query('INSERT INTO user_verification (user_id, token, expires_at) VALUES (?, ?, ?)', [user_id, verificationId, expiration]);

    console.log("New verification record inserted")

    const email = user[0].email;
    const url = 'http://localhost:3000/verify-account/' + verificationId;
    
    client.sendEmail({
      "From": "sbars@student.42lausanne.ch",
      "To": email,
      "Subject": "Hello from Matcha",
      "HtmlBody": `<strong>Hello</strong> dear Matcha user :) <a href=${url}>Verify your account</a>`,
      "TextBody": "Verify your account by clicking the link above",
      "MessageStream": "outbound"
    })

    console.log("Email sent");
  } catch (error) {
    throw new Error(error)
  }
}

module.exports = {
    initVerification
}