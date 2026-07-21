require('dotenv').config();
const axios = require('axios');

const callback = async (req, res) => {
    const { code, code_verifier } = req.body;
    console.log("code", code);
    console.log("code_verifier", code_verifier);
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.SALESFORCE_CLIENT_ID,
        // client_secret: process.env.SALESFORCE_CLIENT_SECRET,
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI,
        code_verifier: code_verifier
      });

      try {
        const response = await axios.post('https://login.salesforce.com/services/oauth2/token', 
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        console.log(response.data);
        // Response will contain:
        // {
        //   access_token: '...',
        //   refresh_token: '...',
        //   instance_url: '...',
        //   id: '...',
        //   token_type: 'Bearer'
        // }
    
        res.json(response.data);
      } catch (error) {
        console.error('Error exchanging code for token:', error.response?.data || error);
        res.status(500).json({ error: error.response?.data || error });
      }
}

module.exports = {
    callback
}

