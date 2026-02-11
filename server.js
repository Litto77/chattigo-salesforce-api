require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

/**
 * Normaliza teléfono Chile
 */
function normalizePhone(raw) {
    if (!raw) return null;

    let p = raw.replace(/[^\d]/g, '');

    if (p.length === 9) return '+56' + p;
    if (p.startsWith('56')) return '+' + p;

    return '+' + p;
}

/**
 * Obtener Access Token Salesforce
 */
async function getAccessToken() {
    const response = await axios.post(
        'https://login.salesforce.com/services/oauth2/token',
        new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: process.env.SF_CLIENT_ID,
            client_secret: process.env.SF_CLIENT_SECRET
        }),
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
    );

    return response.data.access_token;
}

/**
 * Buscar contacto en Salesforce
 */
async function queryContact(token, phone) {

    const query = `
        SELECT Id, FirstName, LastName, Email,
               Account.Name, Account.Owner.Name
        FROM Contact
        WHERE Phone = '${phone}'
        OR MobilePhone = '${phone}'
        LIMIT 1
    `;

    const response = await axios.get(
        process.env.SF_INSTANCE_URL +
        '/services/data/v58.0/query?q=' + encodeURIComponent(query),
        {
            headers: {
                Authorization: 'Bearer ' + token
            }
        }
    );

    return response.data.records[0] || null;
}

/**
 * Webhook Chattigo
 */
app.post('/webhook/chattigo', async (req, res) => {

    try {

        const phone = normalizePhone(req.body.msisdn);

        if (!phone) {
            return res.json({ found: false });
        }

        const token = await getAccessToken();
        const contact = await queryContact(token, phone);

        if (!contact) {
            return res.json({ found: false });
        }

        return res.json({
            found: true,
            firstName: contact.FirstName,
            accountOwner: contact.Account?.Owner?.Name || "",
            accountName: contact.Account?.Name || "",
            email: contact.Email || ""
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        return res.status(500).json({ error: "Internal error" });
    }
});

/**
 * Endpoint de prueba
 */
app.get('/', (req, res) => {
    res.send("API funcionando correctamente");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`API running on port ${PORT}`);
});
