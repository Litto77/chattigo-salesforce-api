const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

// Variables de entorno
const {
  SF_CLIENT_ID,
  SF_USERNAME,
  SF_LOGIN_URL,
  SF_PRIVATE_KEY
} = process.env;

// Función para obtener access_token con JWT
async function getAccessToken() {
  const payload = {
    iss: SF_CLIENT_ID,
    sub: SF_USERNAME,
    aud: SF_LOGIN_URL,
    exp: Math.floor(Date.now() / 1000) + 300
  };

  const token = jwt.sign(payload, SF_PRIVATE_KEY, { algorithm: "RS256" });

  const response = await axios.post(
    `${SF_LOGIN_URL}/services/oauth2/token`,
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: token
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );

  return response.data;
}

// Endpoint de prueba JWT
app.get("/auth-test", async (req, res) => {
  try {
    const auth = await getAccessToken();
    res.json(auth);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Endpoint búsqueda por teléfono
app.post("/search-by-phone", async (req, res) => {
  try {
    let { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone requerido" });

    // Normalizar número
    if (!phone.startsWith("+")) phone = "+" + phone;

    const auth = await getAccessToken();

    const query = `
      SELECT FirstName, Account.OwnerAlias
      FROM Contact
      WHERE MobilePhone = '${phone}'
      LIMIT 1
    `;

    const response = await axios.get(
      `${auth.instance_url}/services/data/v59.0/query`,
      {
        headers: { Authorization: `Bearer ${auth.access_token}` },
        params: { q: query }
      }
    );

    if (response.data.records.length === 0) return res.json({ found: false });

    const contact = response.data.records[0];

    res.json({
      found: true,
      firstName: contact.FirstName,
      ownerAlias: contact.Account?.OwnerAlias
    });

  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// Root
app.get("/", (req, res) => {
  res.send("API funcionando correctamente");
});

// Puerto dinámico para Render
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));
