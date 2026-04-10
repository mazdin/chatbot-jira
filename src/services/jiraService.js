const axios = require('axios');
require('dotenv').config();

const JIRA_DOMAIN = process.env.JIRA_DOMAIN.replace(/\/$/, '');
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

const auth = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

const jiraClient = axios.create({
    baseURL: `${JIRA_DOMAIN}/rest/api/3`,
    headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
});

/**
 * Fetch tasks based on JQL
 * @param {string} jql 
 * @returns {Promise<Array>}
 */
async function fetchTasks(jql) {
    try {
        const response = await jiraClient.get('/search/jql', {
            params: {
                jql: jql,
                // Requesting all fields to find the sprint field
                fields: 'key,summary,status,sprint,created,customfield_10020' 
            }
        });
        
        const issues = response.data.issues || response.data.results || [];
        
        return issues.map(issue => {
            const fields = issue.fields;
            // Sprint might be in 'sprint' or 'customfield_10020'
            const sprintData = fields.sprint || fields.customfield_10020;
            let sprintName = 'No Sprint';
            let startDate = null;
            let endDate = null;
            
            if (sprintData) {
                const sprintInfo = Array.isArray(sprintData) && sprintData.length > 0 ? sprintData[0] : sprintData;
                if (sprintInfo.name) {
                    sprintName = sprintInfo.name;
                    startDate = sprintInfo.startDate ? sprintInfo.startDate.split('T')[0] : null;
                    endDate = sprintInfo.endDate ? sprintInfo.endDate.split('T')[0] : null;
                }
            }

            return {
                key: issue.key,
                summary: fields.summary || 'No Summary',
                status: fields.status ? fields.status.name : 'Unknown',
                sprint: sprintName,
                startDate: startDate,
                endDate: endDate,
                createdDate: fields.created ? fields.created.split('T')[0] : null
            };
        });
    } catch (error) {
        console.error('Error fetching tasks from Jira:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw error;
    }
}

/**
 * Get tasks for the current user in active sprints
 * @param {string|Array} status Optional status filter or array of statuses
 * @returns {Promise<Array>}
 */
async function getMyTasks(status = null) {
    let jql = 'assignee = currentUser() AND sprint in openSprints()';
    if (status) {
        if (Array.isArray(status)) {
            const statusList = status.map(s => `"${s}"`).join(',');
            jql += ` AND status IN (${statusList})`;
        } else {
            jql += ` AND status = "${status}"`;
        }
    }
    return await fetchTasks(jql);
}

/**
 * Get issues for a specific project and type in active sprints
 * @param {string} project 
 * @param {string} type 
 * @returns {Promise<Array>}
 */
async function getProjectIssuesByType(project, type) {
    const jql = `project = '${project}' AND issuetype = '${type}' AND sprint in openSprints()`;
    return await fetchTasks(jql);
}

module.exports = {
    fetchTasks,
    getMyTasks,
    getProjectIssuesByType
};
