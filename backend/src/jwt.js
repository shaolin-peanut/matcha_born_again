const crypto = require('crypto');

const tobase64 = (str) => {
	return btoa(str)
		.replace(/=/g, '') // for url compatibility
		.replace(/\+/g, '-')
		.replace(/\//g, '_');;
}

const generateJwt = (username, id) => {
	const header = { alg: 'HS256', typ: 'JWT' };
	const payload = {
		iss: 'matcha',
		sub: username,
        id: id,
		iat: Math.floor(Date.now() / 1000),
		exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7)
	};
	const encodedData = tobase64(JSON.stringify(header))
        + '.' + tobase64(JSON.stringify(payload));
	const signature = crypto.createHmac('sha256', "super secret key").update(encodedData).digest('base64')
	const encodedSignature = tobase64(signature);
	return (encodedData + '.' + encodedSignature);
}

async function verifyJWT(request, reply) {
    const token = request.cookies.jwt;

    // if env var DEV_MODE is set to true, allow all requests
    if (process.env.DEV_MODE === 'true') {
        console.log('DEV_MODE is true, skipping JWT verification');
        return;
    }
    
    if (!token) {
        reply.code(401).send({ message: 'Missing token' });
        return;
    }
    try {
        const decodedPayload = verifyToken(token, 'your-secret-key');
        // attach just in case that route calls another route
        request.user = decodedPayload;

    } catch (error) {
        reply.code(403).send({ message: error.message });
    }
}


function verifyToken(token, secretKey) {
    const [headerB64, payloadB64, signatureB64] = token.split('.');

    const decodedPayload = JSON.parse(atob(payloadB64));

    // TODO: replace with real key in .env later
    let signatureCheck = crypto.createHmac(
        'sha256', "super secret key")
        .update(`${headerB64}.${payloadB64}`).digest('base64');
    signatureCheck = tobase64(signatureCheck);

    if (signatureB64 !== signatureCheck) {
        throw new Error('Invalid signature, content was altered');
    }

    const now = Math.floor(Date.now() / 1000);
    if (decodedPayload.exp < now) {
        throw new Error('Token has expired');
    }

    return decodedPayload;
}

module.exports = {
    generateJwt, verifyJWT, verifyToken
};