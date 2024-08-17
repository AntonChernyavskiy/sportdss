const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const moment = require('moment');
const bodyParser = require('body-parser');
const etag = require('etag');

const { requiresAuth } = require('express-openid-connect');
const { auth } = require('express-openid-connect');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(fileUpload());

// Auth0 configuration
const config = {
    authRequired: false,
    auth0Logout: true,
    secret: process.env.SECRET || 'a long, randomly-generated string stored in env',
    baseURL: process.env.BASE_URL || 'https://sportdss.eu',
    clientID: process.env.CLIENT_ID || 'yT2he6zIWN8rXoC2YouxeA0WrpLp0KL1',
    issuerBaseURL: process.env.ISSUER_BASE_URL || 'https://dev-xuenlyj535dnppsd.us.auth0.com'
};

app.use(auth(config));

// Middleware to protect specific static files
app.use((req, res, next) => {
    const protectedPaths = ['/admin.html', '/admin_entries.html'];
    if (protectedPaths.includes(req.path) && (!req.oidc.isAuthenticated() || req.oidc.user.sub !== 'google-oauth2|102340706795534265787')) {
        return res.status(403).send('Access Forbidden');
    }
    next();
});

// Generate a version string for cache-busting
const version = Date.now(); // You can use any versioning strategy you prefer

// Serve static files with cache-busting
app.use((req, res, next) => {
    if (req.url.startsWith('/public/')) {
        req.url = `${req.url}?v=${version}`;
    }
    next();
}, express.static(path.join(__dirname, 'public'), {
    etag: false, // Disable default ETag generation
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store'); // Ensure no caching
        res.setHeader('ETag', etag(path)); // Generate a new ETag
    }
}));

// Serve protected admin.html
app.get('/admin.html', requiresAuth(), (req, res) => {
    const sub = req.oidc.user.sub;
    if (sub === 'google-oauth2|102340706795534265787') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.status(403).send('Access Forbidden'); // Unauthorized access
    }
});

// Serve protected admin_entries.html
app.get('/admin_entries.html', requiresAuth(), (req, res) => {
    const sub = req.oidc.user.sub;
    if (sub === 'google-oauth2|102340706795534265787') {
        res.sendFile(path.join(__dirname, 'public', 'admin_entries.html'));
    } else {
        res.status(403).send('Access Forbidden'); // Unauthorized access
    }
});

// Logout route
app.get('/logout', (req, res) => {
    res.oidc.logout();
});

// Get list of files in the files directory
app.get('/files', async (req, res) => {
    try {
        const filesDirectory = path.join(__dirname, 'public', 'files');
        const files = await fs.readdir(filesDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading files directory:', err);
        res.status(500).send('Unable to scan files directory');
    }
});

// Get list of files in a specific event directory
app.get('/files/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'files', eventName);

        const baseFiles = await fs.readdir(eventDirectory);
        const resultsDirectory = path.join(eventDirectory, 'Results');
        const startlistsDirectory = path.join(eventDirectory, 'Startlists');

        const resultsFiles = await fs.readdir(resultsDirectory).catch(() => []);
        const startlistsFiles = await fs.readdir(startlistsDirectory).catch(() => []);

        res.json({
            baseFiles: baseFiles.filter(file => file !== 'Results' && file !== 'Startlists'),
            resultsFiles,
            startlistsFiles
        });
    } catch (err) {
        console.error('Error reading event directory:', err);
        res.status(500).send('Unable to scan event directory');
    }
});

// Create folder and config file for events
app.post('/create-folder_entrySys', async (req, res) => {
    const { date, name, path: basePath } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', basePath, folderName);

    try {
        await fs.mkdir(folderPath, { recursive: true });

        const registrationStartDate = moment().add(1, 'days').format();
        const registrationEndDate = moment(date, 'YYYY-MM-DD').subtract(2, 'days').set({ hour: 20, minute: 59, second: 59 }).format();

        const configPath = path.join(folderPath, 'config.json');
        const csvPath = path.join(folderPath, 'entries.csv');

        const defaultConfig = {
            organizations: [
                "MSĢ TSV SASS",
                "MSĢ TSV Jūrmala",
                "Daugavpils Sporta skola",
                "Jelgavas BJSS",
                "LATC",
                "Rīgas Airētāju klubs",
                "Lielupes airēšanas klubs",
                "Airusports",
                "Other"
            ],
            boatClasses: [
                { class: "Select" },
                { class: "M1x", participants: 1 },
                { class: "W1x", participants: 1 },
                { class: "M2x", participants: 2 },
                { class: "W2x", participants: 2 },
                { class: "M2-", participants: 2 },
                { class: "W2-", participants: 2 },
                { class: "M4x", participants: 4 },
                { class: "W4x", participants: 4 },
                { class: "M4-", participants: 4 },
                { class: "W4-", participants: 4 },
                { class: "M8+", participants: 9, coxswainIndex: 8, coxswainName: "Sturmanis" },
                { class: "W8+", participants: 9, coxswainIndex: 8, coxswainName: "Sturmanis" }
            ],
            registrationStartDate: registrationStartDate,
            registrationEndDate: registrationEndDate
        };

        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');

        const csvData = `Event Abbrev, Crew, Stroke, ContactInfo, Coach, Time`;

        await fs.writeFile(csvPath, csvData, 'utf8');

        res.status(200).send('Folder, config.json, and entries.csv created successfully');
    } catch (err) {
        console.error('Error creating folder, config.json, or entries.csv:', err);
        res.status(500).send('Failed to create folder, config.json, or entries.csv');
    }
});

// Delete a folder
app.post('/delete-folder_entrySys', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'entrySys', folderName);

    try {
        await fs.rmdir(folderPath, { recursive: true });
        res.status(200).send('Folder deleted successfully');
    } catch (err) {
        console.error('Error deleting folder:', err);
        res.status(500).send('Failed to delete folder');
    }
});

// Upload a file
app.post('/upload-file', requiresAuth(), async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const { eventDate, eventName } = req.body;
        const eventFolder = `${eventDate}  ${eventName}`;
        const uploadDir = path.join(__dirname, 'public', 'files', eventFolder);

        await fs.mkdir(uploadDir, { recursive: true });

        const uploadedFile = req.files.file;
        const filePath = path.join(uploadDir, uploadedFile.name);

        await uploadedFile.mv(filePath);

        res.status(200).send('File uploaded successfully');
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).send('Failed to upload file');
    }
});

// Delete a file
app.delete('/delete-file/:eventName/:fileName', requiresAuth(), async (req, res) => {
    try {
        const { eventName, fileName } = req.params;
        const eventDirectory = path.join(__dirname, 'public', 'files', eventName);
        const filePath = path.join(eventDirectory, fileName);

        await fs.unlink(filePath);
        res.status(200).send('File deleted successfully');
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).send('Failed to delete file');
    }
});

// List files in the entrySys directory
app.get('/entrySys', async (req, res) => {
    try {
        const entrySysDirectory = path.join(__dirname, 'public', 'entrySys');
        const files = await fs.readdir(entrySysDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading entrySys directory:', err);
        res.status(500).send('Unable to scan entrySys directory');
    }
});

// List files in a specific event directory within entrySys
app.get('/entrySys/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
        const files = await fs.readdir(eventDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading entrySys event directory:', err);
        res.status(500).send('Unable to scan entrySys event directory');
    }
});

// Get config.json for a specific event
app.get('/entrySys/:eventName/config.json', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const configPath = path.join(__dirname, 'public', 'entrySys', eventName, 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(configData));
    } catch (err) {
        console.error('Error reading config.json:', err);
        res.status(500).send('Unable to read config.json');
    }
});

// Update config.json for a specific event
app.put('/entrySys/:eventName/config.json', requiresAuth(), async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const configPath =  path.join(__dirname, 'public', 'entrySys', eventName, 'config.json');
        const configData = JSON.stringify(req.body, null, 2);
        await fs.writeFile(configPath, configData, 'utf8');
        res.status(200).send('Config.json saved successfully');
    } catch (err) {
        console.error('Error saving config.json:', err);
        res.status(500).send('Unable to save config.json');
    }
});

// Delete an event folder
app.delete('/entrySys/:eventName', requiresAuth(), async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
        await fs.rmdir(eventDirectory, { recursive: true });
        res.status(200).send('Event folder deleted successfully');
    } catch (err) {
        console.error('Error deleting event folder:', err);
        res.status(500).send('Failed to delete event folder');
    }
});

// Create a folder in files directory
app.post('/create-folder', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'files', folderName);

    try {
        await fs.mkdir(folderPath, { recursive: true });
        res.status(200).send('Folder created successfully');
    } catch (err) {
        console.error('Error creating folder:', err);
        res.status(500).send('Failed to create folder');
    }
});

// Delete a folder in files directory
app.post('/delete-folder', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'files', folderName);

    try {
        await fs.rmdir(folderPath, { recursive: true });
        res.status(200).send('Folder deleted successfully');
    } catch (err) {
        console.error('Error deleting folder:', err);
        res.status(500).send('Failed to delete folder');
    }
});

// Get user profile
app.get('/profile', requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user));
});

// Submit an entry
app.post('/submit-entry', async (req, res) => {
    try {
        const { eventDate, eventName, formData } = req.body;

        // Validate formData, eventName, and eventDate
        if (!formData || !eventName || !eventDate) {
            return res.status(400).send('formData, eventName, and eventDate are required');
        }

        // Validate formData structure
        if (!Array.isArray(formData.participants) || formData.participants.length === 0) {
            return res.status(400).send('Invalid formData: participants array is required');
        }

        // Format participants data for CSV
        const formattedParticipants = formData.participants.map(participant => {
            const { license, firstName, lastName, birthYear } = participant;
            let formattedName = 'ERROR-EMPTY';
            if (license) {
                formattedName = license;
            } else if (firstName && lastName && birthYear) {
                const surname = lastName.toUpperCase();
                const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
                const year = birthYear.slice(-2);
                const organization = participant.organization && participant.organization !== 'Other' ? participant.organization : participant.otherOrganization;
                formattedName = organization ? `${organization} / ${surname} ${name} ${year}` : `${surname} ${name} ${year}`;
            }
            return formattedName;
        }).join('<br>');
        

        const trimmedParticipants = formattedParticipants.trim(); // This is now a string

        const boatClass = formData.boatClass;
        const contactInformation = formData.contactInformation;
        const organization = formData.organization;
        const otherOrganization = formData.otherOrganization;

        // Extract and format coach information
        const coachInformation = (formData.coachInformation || '').toUpperCase().replace(/,/g, '/');

        // Get the current server time in YYYY-MM-DD HH:MM:SS format
        const now = new Date();
        const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:MM:SS

        // Prepare CSV data
        const csvData = `\n${boatClass},${organization && organization !== 'Other' ? organization : otherOrganization},${trimmedParticipants},${contactInformation},${coachInformation},${formattedDate}`;
        const eventFolder = `${eventDate}  ${eventName}`;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventFolder);
        const filePath = path.join(eventDirectory, 'entries.csv');

        // Ensure the directory exists, create if it doesn't
        await fs.mkdir(eventDirectory, { recursive: true });

        // Append data to entries.csv
        await fs.appendFile(filePath, csvData, 'utf8');

        // Respond with success message
        res.status(200).send('Entry submitted successfully!');
    } catch (error) {
        console.error('Error submitting entry:', error);
        res.status(500).send('Failed to submit entry');
    }
});

// Download entries.csv for a specific event
app.get('/download-entries/:eventName', requiresAuth(), async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const csvPath = path.join(__dirname, 'public', 'entrySys', eventName, 'entries.csv');
        res.download(csvPath);
    } catch (err) {
        console.error('Error downloading entries.csv:', err);
        res.status(500).send('Unable to download entries.csv');
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
