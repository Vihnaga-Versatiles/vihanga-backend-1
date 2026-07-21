require('dotenv').config();
const KPI = require('../../models/kpi.model');
const axios = require('axios');
const { SALESFORCE_SUBDOMAIN } = process.env;

const successResponse = ({ message, data }) => ({
    success: true,
    data: data ? data : null,
    message,
  });
  const failResponse = ({ message, data }) => ({
    success: false,
    data: data ? data : null,
    message,
  });

const createKPI = async (req, res) => {
    try {
        const kpi = req.body;
        console.log(kpi);
        const newKPI = new KPI(kpi);
        await newKPI.save();
        res.json(successResponse({ message: "KPI created successfully", data: newKPI }));
    } catch (error) {
        res.json(failResponse({ message: error.message }));
    }
}

const getKPIs = async (req, res) => {
    try {
        const { enabled } = req.params;
        let query = {};
        
        if (enabled !== undefined) {
            query.enabled = enabled === 'true';
        }

        const kpis = await KPI.find(query);
        res.json(successResponse({ 
            message: "KPIs retrieved successfully", 
            data: kpis 
        }));
    } catch (error) {
        res.json(failResponse({ message: error.message }));
    }
};

const getKPIById = async (req, res) => {
    try {
        const kpi = await KPI.findById(req.params.id);
        if (!kpi) {
            return res.json(failResponse({ 
                message: "KPI not found" 
            }));
        }
        res.json(successResponse({ 
            message: "KPI retrieved successfully", 
            data: kpi 
        }));
    } catch (error) {
        res.json(failResponse({ message: error.message }));
    }
};

const updateKPIById = async (req, res) => {
    try {
        const updatedKPI = await KPI.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!updatedKPI) {
            return res.json(failResponse({ 
                message: "KPI not found" 
            }));
        }
        res.json(successResponse({ 
            message: "KPI updated successfully", 
            data: updatedKPI 
        }));
    } catch (error) {
        res.json(failResponse({ message: error.message }));
    }
};

const deleteKPIById = async (req, res) => {
    try {
        await KPI.findByIdAndDelete(req.params.id);
        res.json(successResponse({ message: "KPI deleted successfully" }));
    } catch (error) {
        res.json(failResponse({ message: error.message }));
    }
};

const querySalesforce = async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) {
            return res.json(failResponse({ 
                message: "Authorization token is required" 
            }));
        }

        const { query } = req.body;
        if (!query) {
            return res.json(failResponse({ 
                message: "Query string is required" 
            }));
        }

        // Encode the query string for URL
        const encodedQuery = encodeURIComponent(query);
        
        const response = await axios({
            method: 'get',
            url: `https://${SALESFORCE_SUBDOMAIN}.my.salesforce.com/services/data/v59.0/query?q=${encodedQuery}`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(successResponse({ 
            message: "Salesforce data retrieved successfully", 
            data: response.data 
        }));

    } catch (error) {
        // Handle specific Salesforce API errors
        const errorMessage = error.response?.data?.message || error.message;
        res.json(failResponse({ 
            message: `Salesforce query failed: ${errorMessage}`,
            data: error.response?.data
        }));
    }
};

const getSalesforceUser = async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace('Bearer ', '');
        if (!accessToken) {
            return res.json(failResponse({ 
                message: "Authorization token is required" 
            }));
        }

        // Use the userinfo endpoint to get current user details
        const response = await axios({
            method: 'get',
            url: `https://${SALESFORCE_SUBDOMAIN}.my.salesforce.com/services/oauth2/userinfo`,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(successResponse({ 
            message: "Salesforce user retrieved successfully", 
            data: response.data 
        }));
    } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        res.json(failResponse({ 
            message: `Failed to retrieve user info: ${errorMessage}`,
            data: error.response?.data
        }));
    }
};

const getKPIsByEnabled = async (req, res) => {
    try {
        const { enabled } = req.params;
        const isEnabled = enabled === 'true';
        const kpis = await KPI.find({ enabled: isEnabled });
        
        const statusMessage = isEnabled ? 
            "Successfully retrieved enabled KPIs" : 
            "Successfully retrieved disabled KPIs";

        res.json(successResponse({ 
            message: statusMessage, 
            data: kpis 
        }));
    } catch (error) {
        res.json(failResponse({ 
            message: `Failed to retrieve KPIs: ${error.message}`,
            data: error
        }));
    }
};

module.exports = { 
    createKPI, 
    getKPIs, 
    getKPIById, 
    updateKPIById,
    deleteKPIById,
    querySalesforce,
    getSalesforceUser,
    getKPIsByEnabled
};
